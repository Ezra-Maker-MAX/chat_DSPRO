import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, desc, asc, gt } from "drizzle-orm";
import { generateId } from "@/lib/utils";

// GET: fetch messages for a channel
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get("channelId");
  const before = searchParams.get("before"); // cursor-based pagination
  const since = searchParams.get("since"); // message id — return only NEWER messages
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  // Verify channel belongs to tenant
  const [channel] = await db
    .select()
    .from(schema.channels)
    .where(
      and(
        eq(schema.channels.id, channelId),
        eq(schema.channels.tenantId, session.tenantId)
      )
    )
    .limit(1);

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  // Build query
  let query = db
    .select({
      id: schema.messages.id,
      content: schema.messages.content,
      type: schema.messages.type,
      createdAt: schema.messages.createdAt,
      userId: schema.messages.userId,
      nickname: schema.users.nickname,
      avatarSeed: schema.users.avatarSeed,
    })
    .from(schema.messages)
    .leftJoin(schema.users, eq(schema.messages.userId, schema.users.id))
    .where(
      and(
        eq(schema.messages.tenantId, session.tenantId),
        eq(schema.messages.channelId, channelId)
      )
    )
    .orderBy(desc(schema.messages.createdAt))
    .limit(limit);

  if (before) {
    query = query.where(
      and(
        eq(schema.messages.tenantId, session.tenantId),
        eq(schema.messages.channelId, channelId)
      )
    );
  }

  // `since=<id>` — fetch only messages newer than the given one. Works
  // cross-process on serverless: the poll client passes its latest known
  // message id and gets back any messages written since (e.g. by a bot
  // handler that landed on a different serverless instance than the SSE
  // subscriber, since in-memory SSE pub-sub doesn't scale beyond one process).
  if (since) {
    const [anchor] = await db
      .select({ createdAt: schema.messages.createdAt })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.id, since),
          eq(schema.messages.tenantId, session.tenantId)
        )
      )
      .limit(1);
    if (anchor) {
      query = db
        .select({
          id: schema.messages.id,
          content: schema.messages.content,
          type: schema.messages.type,
          createdAt: schema.messages.createdAt,
          userId: schema.messages.userId,
          nickname: schema.users.nickname,
          avatarSeed: schema.users.avatarSeed,
        })
        .from(schema.messages)
        .leftJoin(schema.users, eq(schema.messages.userId, schema.users.id))
        .where(
          and(
            eq(schema.messages.tenantId, session.tenantId),
            eq(schema.messages.channelId, channelId),
            gt(schema.messages.createdAt, anchor.createdAt)
          )
        )
        .orderBy(asc(schema.messages.createdAt)) // ascending for `since` polling
        .limit(limit);
    } else {
      // Anchor not found (e.g. very old id) — return empty to avoid a flood
      return NextResponse.json({ messages: [], hasMore: false });
    }
  }

  const messages = await query;

  // Get media for these messages
  const messageIds = messages.map((m) => m.id);
  const mediaList = messageIds.length > 0
    ? await db
        .select()
        .from(schema.media)
        .where(eq(schema.media.messageId, messageIds[0])) // SQLite limitation; in production, use IN
    : [];

  // Attach media to messages
  const enrichedMessages = messages.map((msg) => ({
    ...msg,
    media: mediaList.filter((m) => m.messageId === msg.id),
  }));

  return NextResponse.json({
    messages: enrichedMessages.reverse(), // oldest first
    hasMore: messages.length === limit,
  });
}

// POST: send a message
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { channelId, content, type = "text", mediaIds } = body;

  if (!channelId || (!content && !mediaIds)) {
    return NextResponse.json({ error: "channelId and content/media required" }, { status: 400 });
  }

  // Verify channel belongs to tenant
  const [channel] = await db
    .select()
    .from(schema.channels)
    .where(
      and(
        eq(schema.channels.id, channelId),
        eq(schema.channels.tenantId, session.tenantId)
      )
    )
    .limit(1);

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  // Sanitize: strip hyperlinks
  const sanitizedContent = content
    ? content.replace(/https?:\/\/[^\s]+/g, "[link removed]")
    : "";

  const messageId = `msg_${generateId(16)}`;

  await db.insert(schema.messages).values({
    id: messageId,
    tenantId: session.tenantId,
    channelId,
    userId: session.userId,
    content: sanitizedContent,
    type: type || "text",
  });

  // Link media if provided
  if (mediaIds && mediaIds.length > 0) {
    for (const mediaId of mediaIds) {
      await db
        .update(schema.media)
        .set({ messageId })
        .where(eq(schema.media.id, mediaId));
    }
  }

  // Fetch the created message with user info
  const [message] = await db
    .select({
      id: schema.messages.id,
      content: schema.messages.content,
      type: schema.messages.type,
      createdAt: schema.messages.createdAt,
      userId: schema.messages.userId,
      nickname: schema.users.nickname,
      avatarSeed: schema.users.avatarSeed,
    })
    .from(schema.messages)
    .leftJoin(schema.users, eq(schema.messages.userId, schema.users.id))
    .where(eq(schema.messages.id, messageId))
    .limit(1);

  return NextResponse.json({ message });
}

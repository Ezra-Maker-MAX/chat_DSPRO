import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, desc, asc, gt, inArray } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { postBotTextMessage, ensureBotUser, readChannelContext } from "@/lib/bot";
import { getModelForTenant } from "@/lib/llm-gateway";
import { generateText } from "ai";
import { ensureTenantBalance } from "@/lib/deepseek-billing";
import { chargeTokens } from "@/lib/pricing";

/** True when the given user id is the synthetic bot row. */
async function isBotUser(userId: string): Promise<boolean> {
  if (!userId) return false;
  if (userId.startsWith("bot_")) return true;
  const [row] = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row?.role === "bot";
}

/**
 * Run the bot's LLM against the latest channel context and post the reply
 * back into the same channel. Shared by /chat slash command and reply-to-bot.
 */
async function replyWithBot(params: {
  tenantId: string;
  channelId: string;
  userId: string;
  nickname: string;
  text: string;
  /** Optional snippet from the message that was replied to (for context). */
  repliedToSnippet?: string;
}) {
  try {
    const bot = await ensureBotUser(params.tenantId);
    const history = await readChannelContext(params.channelId, 20);
    const routed = await getModelForTenant(params.tenantId, params.text);
    if (!routed) {
      await postBotTextMessage({
        tenantId: params.tenantId,
        channelId: params.channelId,
        content: "⚠️ No LLM provider is configured. Add one in Settings → AI Providers, then try again.",
      });
      return;
    }
    // Credit gate — skip generation (post a friendly notice) when out of credit.
    const bal = await ensureTenantBalance(params.tenantId);
    if ((bal.balanceCents ?? 0) <= 0) {
      await postBotTextMessage({
        tenantId: params.tenantId,
        channelId: params.channelId,
        content: "⚠️ 空间额度已用完，请管理员充值后再试。",
      });
      return;
    }
    const system =
      "You are a helpful assistant inside an anonymous chat space. You read the conversation and reply naturally. Keep replies concise.";
    const messages = [
      ...history.map((h) => ({
        role: h.role as "user" | "assistant",
        content: `${h.nickname}: ${h.content}`,
      })),
      params.repliedToSnippet
        ? { role: "user" as const, content: `${params.nickname} replied to a previous message: "${params.repliedToSnippet.slice(0, 200)}"` }
        : { role: "user" as const, content: `${params.nickname}: ${params.text}` },
    ];
    // The actual triggering user line always rides last, even if we also
    // injected a reply-context line above.
    if (params.repliedToSnippet) {
      messages.push({ role: "user" as const, content: `${params.nickname}: ${params.text}` });
    }
    const { text, usage } = await generateText({
      model: routed.provider.model(routed.provider.modelId),
      system,
      messages,
      temperature: 0.8,
    });
    // Per-model pricing charge
    if (usage) {
      const total = (usage as { totalTokens?: number }).totalTokens ?? 0;
      await chargeTokens(
        params.tenantId,
        routed.provider.provider as string,
        routed.provider.modelId,
        Math.ceil(total / 2),
        Math.ceil(total / 2)
      ).catch(() => {});
    }
    await postBotTextMessage({
      tenantId: params.tenantId,
      channelId: params.channelId,
      content: text || "(bot returned an empty reply)",
    });
    void bot; // referenced for clarity; ensureBotUser also runs in postBotTextMessage
  } catch (err) {
    console.error("[replyWithBot] failed:", err);
  }
}

// GET: fetch messages for a channel
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get("channelId");
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

  // Row shape returned by both query branches below.
  type MessageRow = {
    id: string;
    content: string | null;
    type: string | null;
    replyToId: string | null;
    targetUserId: string | null;
    createdAt: string | null;
    userId: string | null;
    nickname: string | null;
    avatarSeed: string | null;
  };

  // `since=<id>` — fetch only messages newer than the given one. Works
  // cross-process on serverless: the poll client passes its latest known
  // message id and gets back any messages written since (e.g. by a bot
  // handler that landed on a different serverless instance than the SSE
  // subscriber, since in-memory SSE pub-sub doesn't scale beyond one process).

  let messages: MessageRow[];
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
    if (!anchor) {
      // Anchor not found (e.g. very old id) — return empty to avoid a flood
      return NextResponse.json({ messages: [], hasMore: false });
    }
    if (!anchor.createdAt) {
      // Anchor has no timestamp — cannot order by it; bail to empty.
      return NextResponse.json({ messages: [], hasMore: false });
    }
    const anchorCreatedAt = anchor.createdAt;
    messages = await db
      .select({
        id: schema.messages.id,
        content: schema.messages.content,
        type: schema.messages.type,
        replyToId: schema.messages.replyToId,
        targetUserId: schema.messages.targetUserId,
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
          gt(schema.messages.createdAt, anchorCreatedAt)
        )
      )
      .orderBy(asc(schema.messages.createdAt)) // ascending for `since` polling
      .limit(limit);
  } else {
    messages = await db
      .select({
        id: schema.messages.id,
        content: schema.messages.content,
        type: schema.messages.type,
        replyToId: schema.messages.replyToId,
        targetUserId: schema.messages.targetUserId,
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
  }

  // Get media for ALL these messages in one IN(...) query — previously this
  // was filtering on `messageId = messageIds[0]` only, so every message except
  // the first had an empty media array and its image/video/audio wouldn't render.
  const messageIds = messages.map((m) => m.id);
  const mediaList = messageIds.length > 0
    ? await db
        .select()
        .from(schema.media)
        .where(inArray(schema.media.messageId, messageIds))
    : [];

  // Hydrate reply-to snippets in one batch. Cheap because most messages
  // won't have a reply; we only fetch when there is at least one replyToId.
  const replyIds = Array.from(
    new Set(messages.map((m) => m.replyToId).filter((v): v is string => Boolean(v)))
  );
  const replySnippets: Record<string, { content: string; nickname: string; type: string }> = {};
  if (replyIds.length > 0) {
    const replied = await db
      .select({
        id: schema.messages.id,
        content: schema.messages.content,
        type: schema.messages.type,
        userId: schema.messages.userId,
        nickname: schema.users.nickname,
      })
      .from(schema.messages)
      .leftJoin(schema.users, eq(schema.messages.userId, schema.users.id))
      .where(
        and(
          inArray(schema.messages.id, replyIds),
          eq(schema.messages.tenantId, session.tenantId)
        )
      );
    for (const r of replied) {
      replySnippets[r.id] = {
        content: r.content || "",
        nickname: r.nickname || "unknown",
        type: r.type || "text",
      };
    }
  }

  // Attach media + reply snippets to messages
  const enrichedMessages = messages.map((msg) => ({
    ...msg,
    media: mediaList.filter((m) => m.messageId === msg.id),
    replyTo: msg.replyToId ? replySnippets[msg.replyToId] || null : null,
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
  const {
    channelId,
    content,
    type = "text",
    mediaIds,
    replyToId,
    targetUserId,
  } = body;

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
    replyToId: replyToId || null,
    targetUserId: targetUserId || null,
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
      replyToId: schema.messages.replyToId,
      targetUserId: schema.messages.targetUserId,
      createdAt: schema.messages.createdAt,
      userId: schema.messages.userId,
      nickname: schema.users.nickname,
      avatarSeed: schema.users.avatarSeed,
    })
    .from(schema.messages)
    .leftJoin(schema.users, eq(schema.messages.userId, schema.users.id))
    .where(eq(schema.messages.id, messageId))
    .limit(1);

  // If the user replied to a bot message, trigger the bot to reply.
  // Done out-of-band so we don't block the response. Missing replyToId/targetUserId
  // gracefully no-ops.
  if (targetUserId && (await isBotUser(targetUserId))) {
    let snippet: string | undefined;
    if (replyToId) {
      const [parent] = await db
        .select({ content: schema.messages.content, type: schema.messages.type })
        .from(schema.messages)
        .where(eq(schema.messages.id, replyToId))
        .limit(1);
      if (parent?.type === "text") snippet = parent.content ?? undefined;
    }
    void replyWithBot({
      tenantId: session.tenantId,
      channelId,
      userId: session.userId,
      nickname: session.nickname,
      text: sanitizedContent || "(empty)",
      repliedToSnippet: snippet,
    });
  }

  return NextResponse.json({ message });
}

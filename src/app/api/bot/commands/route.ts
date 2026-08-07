import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { handleBotCommand } from "@/lib/bot-commands";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/bot/commands
 * Body: { channelId, content }
 * Parses and executes a slash command. If the message isn't a command
 * (handled=false), the caller should treat it as a regular message.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { channelId, content } = body;

  if (!channelId || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "channelId and content required" }, { status: 400 });
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

  const result = await handleBotCommand(
    {
      tenantId: session.tenantId,
      channelId,
      userId: session.userId,
      nickname: session.nickname,
    },
    content
  );

  return NextResponse.json(result);
}

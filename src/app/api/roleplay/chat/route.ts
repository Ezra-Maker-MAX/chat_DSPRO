import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  getCharacterCard,
  getOrCreateSession,
  getSessionHistory,
  appendSessionMessages,
  generateCharacterReply,
  getAuthorNote,
  setAuthorNote,
} from "@/lib/roleplay";
import { detectEmotion } from "@/lib/emotion";
import { getBondStage, MAX_AFFECTION_CAP } from "@/lib/bond";

/**
 * POST /api/roleplay/chat
 * Body: { characterId, message }
 * Creates/resumes the session, appends the user turn, generates the character's
 * reply with world-book lore injection + global jailbreak + Author's Note, and
 * returns it.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { characterId, message } = body;

  if (!characterId) {
    return NextResponse.json({ error: "characterId required" }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  const userTurn = message.trim().slice(0, 2000);

  const result = await getCharacterCard(session.tenantId, characterId);
  if (!result) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }
  // Non-admins may not chat with admin-only cards (same defense as the list).
  if (session.role !== "admin" && result.card.visibility === "admin_only") {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }
  // Non-admins need adultEnabled to chat with adult cards (18+ gate).
  if (session.role !== "admin" && result.card.adult) {
    const [me] = await db
      .select({ adultEnabled: schema.users.adultEnabled })
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1);
    if (!me?.adultEnabled) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }
  }
  const { card, worldBook } = result;

  const rpSession = await getOrCreateSession(session.tenantId, session.userId, characterId);
  const history = await getSessionHistory(rpSession.id);
  const author = await getAuthorNote(rpSession.id);

  // ---- Bond (affection) bookkeeping — female-friendly slow-burn ----
  const oldAffection = rpSession.affection ?? 0;
  const bond = getBondStage(oldAffection);
  const today = new Date().toISOString().slice(0, 10);
  const isFirstToday = rpSession.lastBondDay !== today;
  const isGreeting = /(早安|早上好|早呀|晚安|晚好|good ?morning|good ?night)/i.test(userTurn);
  const gain = 1 + (isFirstToday ? 2 : 0) + (isGreeting ? 2 : 0); // first-of-day +3, greeting +3, both +5
  const newAffection = Math.min(MAX_AFFECTION_CAP, oldAffection + gain);
  const newBond = getBondStage(newAffection);
  const stageUp = newBond.index > bond.index ? newBond : null;

  await db
    .update(schema.roleplaySessions)
    .set({ affection: newAffection, lastBondDay: today })
    .where(eq(schema.roleplaySessions.id, rpSession.id));

  // If this is a fresh session, seed the character's opening line
  const isFirstTurn = history.length === 0;
  let firstMes: string | null = null;
  if (isFirstTurn && card.firstMes) {
    firstMes = card.firstMes;
  }

  try {
    const reply = await generateCharacterReply({
      tenantId: session.tenantId,
      card,
      worldBook,
      history,
      userTurn,
      authorNote: author.note,
      authorNoteDepth: author.depth,
      bondStage: newBond.index,
    });

    await appendSessionMessages(rpSession.id, [
      { role: "user", content: userTurn },
      { role: "assistant", content: reply },
    ]);

    return NextResponse.json({
      success: true,
      reply,
      emotion: detectEmotion(reply),
      firstMes,
      sessionId: rpSession.id,
      affection: newAffection,
      bond: {
        index: newBond.index,
        key: newBond.key,
        progress: newBond.progress,
        toNext: newBond.toNext,
      },
      gain,
      stageUp: stageUp ? { index: stageUp.index, key: stageUp.key } : null,
    });
  } catch (err) {
    // Insufficient credit → tell the frontend to open the recharge modal.
    if (err instanceof Error && err.message === "INSUFFICIENT_CREDIT") {
      return NextResponse.json({ error: "INSUFFICIENT_CREDIT", code: "insufficient_credit" }, { status: 402 });
    }
    const msg = err instanceof Error ? err.message : "Roleplay generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/roleplay/chat?characterId=... — fetch session history.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const characterId = searchParams.get("characterId");
  if (!characterId) {
    return NextResponse.json({ error: "characterId required" }, { status: 400 });
  }

  const rpSession = await getOrCreateSession(session.tenantId, session.userId, characterId);
  const history = await getSessionHistory(rpSession.id);
  const author = await getAuthorNote(rpSession.id);

  const result = await getCharacterCard(session.tenantId, characterId);
  if (!result) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }
  if (session.role !== "admin" && result.card.visibility === "admin_only") {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }
  if (session.role !== "admin" && result.card.adult) {
    const [me] = await db
      .select({ adultEnabled: schema.users.adultEnabled })
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1);
    if (!me?.adultEnabled) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }
  }
  return NextResponse.json({
    sessionId: rpSession.id,
    history,
    card: result.card,
    worldBook: result.worldBook,
    authorNote: author.note,
    authorNoteDepth: author.depth,
    affection: rpSession.affection ?? 0,
    bond: getBondStage(rpSession.affection ?? 0),
  });
}

/**
 * PUT /api/roleplay/chat
 * Body: { characterId, authorNote, authorNoteDepth }
 * Persists the Author's Note for a session (SillyTavern "全局指令微调").
 */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { characterId } = body;
  if (!characterId) {
    return NextResponse.json({ error: "characterId required" }, { status: 400 });
  }

  const rpSession = await getOrCreateSession(session.tenantId, session.userId, characterId);
  const note = typeof body.authorNote === "string" ? body.authorNote : "";
  const depth = Number(body.authorNoteDepth ?? 3);
  await setAuthorNote(rpSession.id, note, depth);

  return NextResponse.json({ success: true, authorNote: note.slice(0, 2000), authorNoteDepth: Math.min(4, Math.max(0, depth)) });
}

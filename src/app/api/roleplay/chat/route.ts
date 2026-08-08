import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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
  const { card, worldBook } = result;

  const rpSession = await getOrCreateSession(session.tenantId, session.userId, characterId);
  const history = await getSessionHistory(rpSession.id);
  const author = await getAuthorNote(rpSession.id);

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
    });
  } catch (err) {
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
  return NextResponse.json({
    sessionId: rpSession.id,
    history,
    card: result?.card || null,
    worldBook: result?.worldBook || null,
    authorNote: author.note,
    authorNoteDepth: author.depth,
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

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  saveCharacterCard,
  listCharacterCards,
  getCharacterCard,
} from "@/lib/roleplay";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/characters — list character cards for the tenant
 * POST /api/characters — create a character card
 * Body: { name, description?, personality?, scenario?, firstMes?, mesExample?, systemPrompt?, postHistoryInstructions?, worldBookId? }
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cards = await listCharacterCards(session.tenantId);
  return NextResponse.json({ cards });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Character name is required" }, { status: 400 });
  }
  if (name.length > 60) {
    return NextResponse.json({ error: "Name must be 60 characters or fewer" }, { status: 400 });
  }

  // Validate worldBookId if provided
  if (body.worldBookId) {
    const [wb] = await db
      .select()
      .from(schema.worldBooks)
      .where(
        and(
          eq(schema.worldBooks.id, body.worldBookId),
          eq(schema.worldBooks.tenantId, session.tenantId)
        )
      )
      .limit(1);
    if (!wb) {
      return NextResponse.json({ error: "World book not found" }, { status: 400 });
    }
  }

  const id = await saveCharacterCard(session.tenantId, session.userId, {
    name,
    description: body.description,
    personality: body.personality,
    scenario: body.scenario,
    firstMes: body.firstMes,
    mesExample: body.mesExample,
    systemPrompt: body.systemPrompt,
    postHistoryInstructions: body.postHistoryInstructions,
    worldBookId: body.worldBookId || null,
    avatarUrl: body.avatarUrl || null,
  });

  return NextResponse.json({ success: true, id });
}

/** PATCH /api/characters — update a character card. Body same as POST + { id }. */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const id = body.id;
  const name = body.name?.trim();
  if (!id || !name) {
    return NextResponse.json({ error: "id and name are required" }, { status: 400 });
  }
  if (name.length > 60) {
    return NextResponse.json({ error: "Name must be 60 characters or fewer" }, { status: 400 });
  }

  // Verify ownership
  const [card] = await db
    .select()
    .from(schema.characterCards)
    .where(
      and(
        eq(schema.characterCards.id, id),
        eq(schema.characterCards.tenantId, session.tenantId)
      )
    )
    .limit(1);
  if (!card) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }
  if (session.role !== "admin" && card.createdBy !== session.userId) {
    return NextResponse.json({ error: "Admin only or creator only" }, { status: 403 });
  }

  // Validate worldBookId if provided
  if (body.worldBookId) {
    const [wb] = await db
      .select()
      .from(schema.worldBooks)
      .where(
        and(
          eq(schema.worldBooks.id, body.worldBookId),
          eq(schema.worldBooks.tenantId, session.tenantId)
        )
      )
      .limit(1);
    if (!wb) {
      return NextResponse.json({ error: "World book not found" }, { status: 400 });
    }
  }

  await saveCharacterCard(session.tenantId, session.userId, {
    name,
    description: body.description,
    personality: body.personality,
    scenario: body.scenario,
    firstMes: body.firstMes,
    mesExample: body.mesExample,
    systemPrompt: body.systemPrompt,
    postHistoryInstructions: body.postHistoryInstructions,
    worldBookId: body.worldBookId || null,
    avatarUrl: body.avatarUrl || null,
  }, id);

  return NextResponse.json({ success: true, id });
}

/** DELETE /api/characters?id=... — remove a card (admin or creator). */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const [card] = await db
    .select()
    .from(schema.characterCards)
    .where(
      and(
        eq(schema.characterCards.id, id),
        eq(schema.characterCards.tenantId, session.tenantId)
      )
    )
    .limit(1);

  if (!card) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  if (session.role !== "admin" && card.createdBy !== session.userId) {
    return NextResponse.json({ error: "Admin only or creator only" }, { status: 403 });
  }

  await db.delete(schema.roleplaySessions).where(eq(schema.roleplaySessions.characterId, id));
  await db.delete(schema.characterCards).where(eq(schema.characterCards.id, id));

  return NextResponse.json({ success: true });
}

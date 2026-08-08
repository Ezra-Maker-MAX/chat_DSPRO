import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCharacterCard, saveCharacterCard } from "@/lib/roleplay";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

/** Coerce incoming emotes into a length-4 (string|null)[]; pad/clip & filter URLs. */
function normalizeEmotes(raw: unknown): (string | null)[] {
  if (!Array.isArray(raw)) return [null, null, null, null];
  const out: (string | null)[] = [];
  for (let i = 0; i < 4; i++) {
    const v = raw[i];
    out.push(typeof v === "string" && v.length > 0 ? v : null);
  }
  return out;
}

type Params = { params: Promise<{ id: string }> };

/** GET /api/characters/[id] — single card + world book. */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const result = await getCharacterCard(session.tenantId, id);
  if (!result) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }
  // Non-admins may not fetch admin-only cards (defense in depth — the list
  // endpoint already hides them, but a direct GET must not leak them either).
  if (session.role !== "admin" && result.card.visibility === "admin_only") {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}

/** PUT /api/characters/[id] — update a card (admin or creator). */
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

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

  const body = await req.json();
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Character name is required" }, { status: 400 });
  }

  await saveCharacterCard(
    session.tenantId,
    session.userId,
    {
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
      emotes: normalizeEmotes(body.emotes),
      // Only admins may flip visibility; creators editing their own card keep it.
      visibility:
        session.role === "admin"
          ? body.visibility === "admin_only"
            ? "admin_only"
            : "public"
          : undefined,
    },
    id
  );

  return NextResponse.json({ success: true });
}

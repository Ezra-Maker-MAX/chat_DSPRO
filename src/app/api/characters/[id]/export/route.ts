import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCharacterCard, getWorldBookWithEntries } from "@/lib/roleplay";
import {
  buildCharaCardV2,
  embedCharaChunk,
  FALLBACK_PNG_BASE64,
} from "@/lib/chara-card";
import { Buffer } from "buffer";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/characters/[id]/export
 * Returns a PNG with embedded chara_card_v2 metadata — directly importable
 * into SillyTavern. Uses the card's avatar image if present, otherwise a
 * 1x1 placeholder (the card data lives in the PNG chunk, not the pixels).
 */
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
  // Non-admins may not export admin-only cards.
  if (session.role !== "admin" && result.card.visibility === "admin_only") {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }
  const { card } = result;

  let worldBook: { book: any; entries: any[] } | null = null;
  if (card.worldBookId) {
    worldBook = await getWorldBookWithEntries(session.tenantId, card.worldBookId);
  }

  const chara = buildCharaCardV2(card, worldBook);

  // Acquire base image bytes.
  let baseBuffer: Buffer;
  if (card.avatarUrl) {
    try {
      const r = await fetch(card.avatarUrl);
      if (r.ok) baseBuffer = Buffer.from(await r.arrayBuffer());
      else baseBuffer = Buffer.from(FALLBACK_PNG_BASE64, "base64");
    } catch {
      baseBuffer = Buffer.from(FALLBACK_PNG_BASE64, "base64");
    }
  } else {
    baseBuffer = Buffer.from(FALLBACK_PNG_BASE64, "base64");
  }

  let png: Buffer;
  try {
    png = embedCharaChunk(baseBuffer, chara);
  } catch {
    // If the stored avatar isn't a valid PNG, wrap the metadata in a placeholder.
    png = embedCharaChunk(Buffer.from(FALLBACK_PNG_BASE64, "base64"), chara);
  }

  const safeName = (card.name || "character").replace(/[^\w\u4e00-\u9fa5-]+/g, "_");
  return new NextResponse(png, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${safeName}.png"`,
      "Cache-Control": "no-store",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildAndUploadAvatar } from "@/lib/chara-avatar";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/**
 * POST /api/characters/avatar/upload  (multipart/form-data)
 * Fields: file (image), card (JSON string of the card fields), cardId?
 * Embeds chara_card_v2 metadata into the uploaded image and returns the URL.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const cardRaw = form.get("card");
  const cardId = (form.get("cardId") as string) || undefined;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file provided" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type. Use PNG, JPEG, WebP or GIF." },
      { status: 400 }
    );
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Image too large (max 10 MB)." }, { status: 400 });
  }
  if (!cardRaw || typeof cardRaw !== "string") {
    return NextResponse.json({ error: "Card metadata is required" }, { status: 400 });
  }

  let card: any;
  try {
    card = JSON.parse(cardRaw);
  } catch {
    return NextResponse.json({ error: "Invalid card metadata" }, { status: 400 });
  }
  if (!card?.name?.trim()) {
    return NextResponse.json({ error: "Character name is required" }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const url = await buildAndUploadAvatar(
      session.tenantId,
      {
        name: card.name,
        description: card.description,
        personality: card.personality,
        scenario: card.scenario,
        firstMes: card.firstMes,
        mesExample: card.mesExample,
        systemPrompt: card.systemPrompt,
        postHistoryInstructions: card.postHistoryInstructions,
      },
      card.worldBookId,
      bytes,
      cardId
    );
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

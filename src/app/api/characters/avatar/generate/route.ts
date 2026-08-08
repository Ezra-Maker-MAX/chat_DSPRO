import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureBotProfile, generateImageBytes } from "@/lib/bot";
import { buildAndUploadAvatar } from "@/lib/chara-avatar";

/**
 * POST /api/characters/avatar/generate
 * Body: { name, description?, personality?, scenario?, firstMes?, mesExample?,
 *         systemPrompt?, postHistoryInstructions?, worldBookId?, prompt?, cardId? }
 * Generates a portrait via the tenant's image gateway, embeds the character
 * card (chara_card_v2) into the PNG, and returns the public URL.
 */
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

  const profile = await ensureBotProfile(session.tenantId);
  if (!profile.imageApiKey) {
    return NextResponse.json(
      { error: "Image gateway is not configured. Add an API key in Settings → Bot." },
      { status: 400 }
    );
  }

  // Use the user-provided prompt, else synthesise a portrait prompt from the card.
  const prompt =
    body.prompt?.trim() ||
    [
      "character portrait, full-body friendly illustration",
      `subject: ${name}`,
      body.description || "",
      body.personality || "",
    ]
      .filter(Boolean)
      .join(", ");

  try {
    const bytes = await generateImageBytes(profile, prompt);
    const url = await buildAndUploadAvatar(
      session.tenantId,
      {
        name,
        description: body.description,
        personality: body.personality,
        scenario: body.scenario,
        firstMes: body.firstMes,
        mesExample: body.mesExample,
        systemPrompt: body.systemPrompt,
        postHistoryInstructions: body.postHistoryInstructions,
      },
      body.worldBookId,
      bytes,
      body.cardId || undefined
    );
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

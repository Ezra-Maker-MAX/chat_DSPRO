import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { aiGenerateText, extractJson, localeName } from "@/lib/ai-generate";
import { isVibeTag } from "@/lib/tags";

/**
 * POST /api/characters/generate — AI-assisted character card creation.
 * Body: { prompt, adult?, locale? }
 * Returns a fully-formed card (all editable fields) the client can drop
 * straight into the editor form. Costs LLM tokens from the tenant balance.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { prompt?: unknown; adult?: unknown; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 1500) : "";
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }
  const adult = body.adult === true;
  const lang = localeName(typeof body.locale === "string" ? body.locale : undefined);

  const system = [
    `You are a master character-card designer for a roleplay platform (SillyTavern-style cards).`,
    `Create ONE vivid, playable character card that matches the user's request.`,
    `All text must be written in ${lang}.`,
    `The character is always an adult fictional character. ${adult ? "Mature/romantic themes are allowed, keep it tasteful and emotionally grounded." : "Keep content wholesome and suitable for all ages."}`,
    `Reply with ONLY a valid JSON object, no markdown, no commentary:`,
    `{`,
    `  "name": "character name (short, distinctive)",`,
    `  "description": "2-3 sentence in-universe introduction of who they are",`,
    `  "personality": "rich personality traits, flaws, quirks, speaking style",`,
    `  "scenario": "the opening scene — where the user meets them, setting, situation",`,
    `  "firstMes": "the character's first spoken line to the user, fully in character and immersive",`,
    `  "mesExample": "2-4 short example dialogue turns showing tone and style",`,
    `  "systemPrompt": "a detailed system prompt: role, voice, boundaries, how to act toward the user, writing style for replies",`,
    `  "tags": ["pick 0-3 archetype tags from this exact list: gentle, dominant, younger, older, childhood, bickering, yandere, cold, wild, gentleman"]`,
    `}`,
    `Make description/personality/scenario rich (2-4 sentences each). firstMes must hook the user immediately.`,
  ].join("\n");

  try {
    const text = await aiGenerateText(session.tenantId, {
      system,
      user: prompt,
      maxTokens: 1400,
      adminFree: session.role === "admin",
    });
    const card = extractJson<Record<string, unknown>>(text);
    if (!card || typeof card.name !== "string" || !card.name.trim()) {
      return NextResponse.json({ error: "The model returned an invalid card. Try again." }, { status: 502 });
    }

    const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 4000) : "");
    const tags = Array.isArray(card.tags)
      ? card.tags.filter(isVibeTag).slice(0, 5)
      : [];

    return NextResponse.json({
      ok: true,
      card: {
        name: str(card.name).slice(0, 60),
        description: str(card.description),
        personality: str(card.personality),
        scenario: str(card.scenario),
        firstMes: str(card.firstMes),
        mesExample: str(card.mesExample),
        systemPrompt: str(card.systemPrompt),
        tags,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    if (msg === "INSUFFICIENT_CREDIT") {
      return NextResponse.json({ error: "INSUFFICIENT_CREDIT", code: "insufficient_credit" }, { status: 402 });
    }
    if (msg === "NO_PROVIDER") {
      return NextResponse.json(
        { error: "No AI provider is configured. Add one in Settings → AI Providers." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

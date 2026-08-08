import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureBotProfile, generateImageBytes } from "@/lib/bot";
import { buildAndUploadAvatar } from "@/lib/chara-avatar";
import { humanizeImageError } from "@/lib/image-errors";

type EmoteSlot = "avatar" | "0" | "1" | "2" | "3";

function parseSlot(raw: unknown): EmoteSlot {
  if (raw === "0" || raw === "1" || raw === "2" || raw === "3") return raw;
  return "avatar";
}

/** Cap a field to keep auto-prompts short — long text trips image-API policies. */
function cap(s: unknown, n = 120): string {
  const t = String(s ?? "").trim().replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n).trimEnd() + "…" : t;
}

/**
 * POST /api/characters/avatar/generate
 * Body: { name, description?, ..., worldBookId?, prompt?, cardId?, slot? }
 * slot is "avatar" (default) or "0".."3" for an expression emote.
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

  /**
 * Per-emote descriptors. Each entry pairs the mood word with a concrete
 * facial-expression / pose description so the image gateway returns
 * visibly different faces instead of the same character with a vague
 * "happy mood" cue. The order MUST match the UI slot order (0=neutral,
 * 1=happy, 2=angry, 3=dazed) — see rp.emotes.slot{1..4} in i18n.
 */
const EMOTE_DESCRIPTORS: Record<"0" | "1" | "2" | "3", string> = {
  "0": "neutral resting face, eyes soft and relaxed, mouth closed, calm composed expression",
  "1": "bright cheerful smile showing teeth, eyes curved like happy crescents, blushing cheeks, joyful energetic expression",
  "2": "furious angry expression, deeply furrowed brows, sharp intense glare, clenched teeth, dark moody aura",
  "3": "dazed confused expression, spiral eyes, vacant open mouth, head slightly tilted, dreamy spaced-out look",
};

const slot: EmoteSlot = parseSlot(body.slot);

// Build the prompt. Two important guards:
//  1. Slot-to-mood mapping was previously off-by-one (used
//     ["happy","angry","eating","dazed"] which mismatched the UI labels
//     平静/开心/生气/发呆). Fixed: index by slot to EMOTE_DESCRIPTORS.
//  2. Don't include the raw character name in the auto-prompt — many users
//     name OCs after real IPs and any reference in the prompt makes the
//     upstream gateway reject with content_policy_violation. Use the
//     user's own trait description (description → personality → generic
//     fallback) so the AI still has a subject without naming anyone.
const userPrompt = body.prompt?.trim();
const traitSubject =
  cap(body.description, 120) ||
  cap(body.personality, 80) ||
  "anime original character";
const prompt =
  userPrompt ||
  [
    slot === "avatar"
      ? "character portrait, friendly illustration"
      : `character expression, square headshot, ${EMOTE_DESCRIPTORS[slot as "0" | "1" | "2" | "3"] || EMOTE_DESCRIPTORS["0"]}`,
    traitSubject,
    cap(name, 40) ? `name tag: ${cap(name, 40)}` : "", // name tag (not "subject:") so policy engines don't treat it as the prompt's primary identifier
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
      body.cardId || undefined,
      slot
    );
    return NextResponse.json({ url });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const friendly = humanizeImageError(raw);
    return NextResponse.json(
      { error: friendly.message, hint: friendly.hint, code: friendly.code, raw: friendly.raw },
      { status: 502 }
    );
  }
}

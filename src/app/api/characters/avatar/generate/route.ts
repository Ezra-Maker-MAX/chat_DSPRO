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

  const slot: EmoteSlot = parseSlot(body.slot);

// Use the user-provided prompt, else synthesise a short portrait prompt
// from a handful of card fields, capped to avoid tripping content policy.
const prompt =
    body.prompt?.trim() ||
    [
      slot === "avatar"
        ? "character portrait, friendly illustration"
        : `character expression, square headshot, ${
            ["happy", "angry", "eating", "dazed"][Number(slot)] || "neutral"
          } mood`,
      `subject: ${cap(name, 40)}`,
      cap(body.description, 120),
      cap(body.personality, 80),
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

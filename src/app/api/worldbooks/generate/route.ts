import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { aiGenerateText, extractJson, localeName } from "@/lib/ai-generate";

interface GeneratedEntry {
  keys: string[];
  secondaryKeys?: string[];
  content: string;
}

/**
 * POST /api/worldbooks/generate — AI-assisted world book creation.
 * Body: { prompt, locale? }
 * Returns a world-book container + 5-8 trigger entries ready to create.
 * Costs LLM tokens from the tenant balance.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { prompt?: unknown; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 1500) : "";
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }
  const lang = localeName(typeof body.locale === "string" ? body.locale : undefined);

  const system = [
    `You are a world-building expert creating a SillyTavern-style lorebook (world book) for a roleplay platform.`,
    `The lorebook enriches a story with canonical facts that activate by keyword.`,
    `All text must be written in ${lang}.`,
    `Reply with ONLY a valid JSON object, no markdown, no commentary:`,
    `{`,
    `  "name": "world book title (short, evocative)",`,
    `  "description": "1-2 sentence summary of the world",`,
    `  "entries": [`,
    `    { "keys": ["trigger keyword", "synonym"], "content": "40-120 word lore/fact about this keyword. Written as neutral canonical fact, not dialogue." },`,
    `    ... 5 to 8 entries total ...`,
    `  ]`,
    `}`,
    `Rules:`,
    `- Each entry's keys are short concrete nouns/names/places from the world (2-4 keys each).`,
    `- Content must be self-contained facts the AI should keep consistent (history, locations, characters, rules, relationships, magic/tech).`,
    `- Entries must be distinct and cover the world broadly — don't repeat the same topic.`,
  ].join("\n");

  try {
    const text = await aiGenerateText(session.tenantId, {
      system,
      user: prompt,
      maxTokens: 1800,
      adminFree: session.role === "admin",
    });
    const data = extractJson<{ name?: unknown; description?: unknown; entries?: unknown }>(text);
    if (!data || typeof data.name !== "string" || !data.name.trim() || !Array.isArray(data.entries)) {
      return NextResponse.json({ error: "The model returned an invalid world book. Try again." }, { status: 502 });
    }

    const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 4000) : "");
    const entries: GeneratedEntry[] = data.entries
      .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
      .slice(0, 8)
      .map((e) => {
        const keys = Array.isArray(e.keys)
          ? e.keys.filter((k): k is string => typeof k === "string" && k.trim().length > 0).map((k) => k.trim().slice(0, 40))
          : [];
        const secondary = Array.isArray(e.secondaryKeys)
          ? e.secondaryKeys.filter((k): k is string => typeof k === "string" && k.trim().length > 0).map((k) => k.trim().slice(0, 40))
          : [];
        return {
          keys: keys.slice(0, 6),
          ...(secondary.length > 0 ? { secondaryKeys: secondary.slice(0, 6) } : {}),
          content: str(e.content),
        };
      })
      .filter((e) => e.keys.length > 0 && e.content);

    if (entries.length === 0) {
      return NextResponse.json({ error: "The model returned an invalid world book. Try again." }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      book: {
        name: str(data.name).slice(0, 80),
        description: str(data.description),
      },
      entries,
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

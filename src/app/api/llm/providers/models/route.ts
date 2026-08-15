import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/llm/providers/models
 * Body options:
 *   - { id: "<providerId>" }       — list models for an existing saved provider
 *   - { provider, apiKey, baseUrl } — list models for an unsaved provider (form preview)
 *
 * Returns { models: ["model-id-1", "model-id-2", ...] } on success.
 *
 * Strategy: hit GET {baseUrl}/models with the provider's API key. Works for
 * OpenAI / DeepSeek / Ollama / LM Studio / any OpenAI-compatible server.
 * Falls back to a curated default list if the endpoint is unavailable.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  let { provider, apiKey, baseUrl } = body as {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
  };
  apiKey = apiKey?.trim();

  if (body.id && typeof body.id === "string") {
    const [row] = await db
      .select()
      .from(schema.llmProviders)
      .where(
        and(
          eq(schema.llmProviders.id, body.id),
          eq(schema.llmProviders.tenantId, session.tenantId)
        )
      )
      .limit(1);
    if (!row) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    provider = row.provider;
    apiKey = row.apiKey?.trim();
    baseUrl = row.baseUrl || undefined;
  }

  if (!provider || !apiKey) {
    return NextResponse.json({ error: "provider and apiKey are required" }, { status: 400 });
  }

  // Anthropic has no list-models endpoint — return the curated list
  if (provider === "anthropic") {
    return NextResponse.json({
      models: DEFAULT_ANTHROPIC_MODELS,
      source: "curated",
    });
  }

  // OpenAI-compatible: hit {baseUrl}/models
  const base = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const url = `${base}/models`;

  try {
    const resp = await fetchWithTimeout(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    }, 12_000);

    if (!resp.ok) {
      return NextResponse.json({
        models: defaultModelsForProvider(provider),
        source: "fallback",
        warning: friendlyFetchWarning(provider, base, `Endpoint returned ${resp.status}`),
      });
    }

    const data = await resp.json();
    const ids = Array.isArray(data?.data)
      ? data.data.map((m: { id?: string }) => m.id).filter(Boolean)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({
        models: defaultModelsForProvider(provider),
        source: "fallback",
        warning: friendlyFetchWarning(provider, base, "Provider returned no models"),
      });
    }

    // Sort with common defaults first
    const sorted = sortModels(ids);
    return NextResponse.json({ models: sorted, source: "live" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return NextResponse.json({
      models: defaultModelsForProvider(provider),
      source: "fallback",
      warning: friendlyFetchWarning(provider, base, msg),
    });
  }
}

/** Build a clear, actionable warning that hints at the most common fix
 *  (missing /v1 path) and reminds Custom providers that hand-keyed model
 *  IDs are the expected path. */
function friendlyFetchWarning(
  provider: string,
  baseUrl: string | undefined,
  detail: string
): string {
  const path = `${(baseUrl || "https://api.openai.com/v1").replace(/\/$/, "")}/models`;
  if (provider === "custom") {
    return `Couldn't reach ${path} — ${detail}. Private endpoints often don't expose /models — just type the model ID manually below.`;
  }
  return `Couldn't reach ${path} — ${detail}. Check the base URL (most providers need a /v1 suffix) and API key.`;
}

function defaultModelsForProvider(provider: string): string[] {
  if (provider === "openai") return DEFAULT_OPENAI_MODELS;
  if (provider === "deepseek") return DEFAULT_DEEPSEEK_MODELS;
  if (provider === "google") return DEFAULT_GOOGLE_MODELS;
  return [];
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Curated fallbacks (in case the /models endpoint is unavailable)
const DEFAULT_OPENAI_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
  "o1",
  "o1-mini",
  "o1-preview",
];
const DEFAULT_DEEPSEEK_MODELS = ["deepseek-chat", "deepseek-reasoner"];
const DEFAULT_GOOGLE_MODELS = ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash-exp"];
const DEFAULT_ANTHROPIC_MODELS = [
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-20240620",
  "claude-3-opus-20240229",
  "claude-3-haiku-20240307",
];

function sortModels(ids: string[]): string[] {
  const ranked = new Map<string, number>([
    ["gpt-4o", 1], ["gpt-4o-mini", 2],
    ["deepseek-chat", 3], ["deepseek-reasoner", 4],
    ["claude-3-5-sonnet-20241022", 5],
    ["gemini-1.5-pro", 6], ["gemini-1.5-flash", 7],
  ]);
  return [...ids].sort((a, b) => {
    const ra = ranked.get(a) ?? 100;
    const rb = ranked.get(b) ?? 100;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}
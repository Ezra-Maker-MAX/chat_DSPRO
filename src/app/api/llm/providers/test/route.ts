import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/llm/providers/test
 * Body options:
 *   - { id: "<providerId>" }  — test an existing saved provider (uses stored apiKey/baseUrl)
 *   - { provider, model, apiKey, baseUrl } — test an unsaved provider (form preview)
 *
 * Returns { ok: true, latencyMs, sample } on success, or { ok: false, error } on failure.
 *
 * Strategy: send a 1-token "ping" to the chat completions endpoint and time it.
 * Works with any OpenAI-compatible API (OpenAI / DeepSeek / Anthropic-via-proxy / etc).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  let { provider, model, apiKey, baseUrl } = body as {
    provider?: string;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  };

  // If id given, load from DB
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
    model = row.model;
    apiKey = row.apiKey;
    baseUrl = row.baseUrl || undefined;
  }

  if (!provider || !model || !apiKey) {
    return NextResponse.json(
      { error: "provider, model, and apiKey are required" },
      { status: 400 }
    );
  }

  // Use a provider-specific ping strategy
  const url = buildChatURL(provider, baseUrl);
  const start = Date.now();

  try {
    const resp = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(provider === "anthropic" ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } : {}),
      },
      body: JSON.stringify(buildPingBody(provider, model)),
    }, 15_000);

    const latencyMs = Date.now() - start;
    const text = await resp.text();
    if (!resp.ok) {
      // Try to surface a helpful error from common API shapes
      const detail = extractErrorMessage(text, provider) || resp.statusText;
      return NextResponse.json(
        { ok: false, error: `HTTP ${resp.status}: ${detail}`, latencyMs },
        { status: 200 }
      );
    }
    return NextResponse.json({
      ok: true,
      latencyMs,
      sample: extractSampleReply(text, provider),
      endpoint: url,
    });
  } catch (e) {
    const latencyMs = Date.now() - start;
    const msg = e instanceof Error ? e.message : "Network error";
    return NextResponse.json(
      { ok: false, error: msg, latencyMs },
      { status: 200 }
    );
  }
}

function buildChatURL(provider: string, baseUrl?: string): string {
  // Anthropic has its own shape; everything else is OpenAI-compatible
  if (provider === "anthropic") {
    const base = (baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
    return `${base}/v1/messages`;
  }
  const base = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  return `${base}/chat/completions`;
}

// Providers that speak the OpenAI chat/completions shape. Anything else
// (notably anthropic) uses a different request format.
function isOpenAICompat(provider: string): boolean {
  return provider !== "anthropic";
}

function buildPingBody(provider: string, model: string): unknown {
  // Keep the body minimal and provider-safe. Non-OpenAI proxies (LiteLLM /
  // Agnes-forwarded gateways) reject OpenAI-only fields such as
  // response_format, logprobs, seed, n, stream_options — so we never send
  // them here. max_tokens is supported by both OpenAI-compat and Anthropic.
  if (provider === "anthropic") {
    return {
      model,
      max_tokens: 8,
      messages: [{ role: "user", content: "ping" }],
    };
  }
  // OpenAI-compatible (openai / deepseek / google / custom / unknown)
  return {
    model,
    max_tokens: 4,
    messages: [{ role: "user", content: "ping" }],
  };
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

function extractErrorMessage(text: string, provider: string): string | null {
  try {
    const j = JSON.parse(text);
    if (provider === "anthropic" && j?.error?.message) return j.error.message;
    if (j?.error?.message) return j.error.message;
    if (j?.message) return j.message;
  } catch {
    /* not JSON */
  }
  // Truncate long non-JSON bodies
  return text.length > 200 ? text.slice(0, 200) + "…" : text || null;
}

function extractSampleReply(text: string, provider: string): string {
  try {
    const j = JSON.parse(text);
    if (provider === "anthropic") {
      const content = j?.content?.[0]?.text;
      return content || "(empty reply)";
    }
    return j?.choices?.[0]?.message?.content || "(empty reply)";
  } catch {
    return "(received non-JSON response)";
  }
}
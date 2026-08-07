import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureBotProfile } from "@/lib/bot";

/**
 * POST /api/bot/profile/test-image
 * Tests the bot's image gateway by issuing a tiny image-generation request
 * (1x1 transparent PNG, 1 token-equivalent). Body is optional — uses the
 * stored bot profile config when no overrides are given.
 *
 * Body (optional): { provider, model, apiKey, baseUrl, size? }
 *
 * Returns: { ok, latencyMs, sample, error?, warning? }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const profile = await ensureBotProfile(session.tenantId);
  const body = await req.json().catch(() => ({}));
  const overrides = body && typeof body === "object" ? body : {};

  // Prefer explicit body fields, fall back to stored profile.
  // The stored apiKey is NOT returned by GET, so callers must include it
  // when testing before save.
  const provider = overrides.provider ?? profile.imageProvider ?? "openai";
  const model = overrides.model ?? profile.imageModel ?? "gpt-image-1";
  const apiKey = overrides.apiKey ?? profile.imageApiKey;
  const baseUrl = overrides.baseUrl ?? profile.imageBaseUrl ?? undefined;
  const size = overrides.size ?? "256x256";

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No API key on file. Paste the API key in the gateway form first, then click Test.",
      },
      { status: 200 }
    );
  }

  const url = buildImageURL(provider, baseUrl);
  const start = Date.now();

  try {
    const resp = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildImageBody(provider, model, size)),
    }, 60_000);

    const latencyMs = Date.now() - start;
    const text = await resp.text();

    if (!resp.ok) {
      return NextResponse.json({
        ok: false,
        latencyMs,
        error: extractErrorMessage(text) || `HTTP ${resp.status}`,
        endpoint: url,
      });
    }

    // Most image APIs return either JSON with base64 OR binary. For a small
    // test we accept either; we don't decode the image.
    let sample = "(image generated)";
    try {
      const j = JSON.parse(text);
      if (Array.isArray(j?.data) && j.data[0]?.b64_json) {
        sample = `image (${j.data[0].b64_json.length} chars b64)`;
      } else if (Array.isArray(j?.data) && j.data[0]?.url) {
        sample = `url=${j.data[0].url.slice(0, 80)}…`;
      }
    } catch {
      sample = `binary (${text.length} bytes)`;
    }

    return NextResponse.json({ ok: true, latencyMs, sample, endpoint: url });
  } catch (e) {
    return NextResponse.json(
      { ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : "Network error" },
      { status: 200 }
    );
  }
}

function buildImageURL(provider: string, baseUrl?: string): string {
  const base = (baseUrl || defaultBaseUrl(provider)).replace(/\/$/, "");
  return `${base}/images/generations`;
}

function defaultBaseUrl(provider: string): string {
  if (provider === "openai") return "https://api.openai.com/v1";
  if (provider === "custom") return "https://api.openai.com/v1";
  return "https://api.openai.com/v1";
}

function buildImageBody(provider: string, model: string, size: string): unknown {
  // Build a minimal body that works across providers.
  // Many non-OpenAI proxies (Agnes, LiteLLM-forwarded models) reject
  // response_format / size / n.  We send only what's safe for a
  // connectivity ping.
  const body: Record<string, unknown> = {
    model,
    prompt: "a single solid color square",
  };

  // Only add OpenAI-specific params when we're reasonably sure the
  // endpoint accepts them (native OpenAI or known-compatible proxy).
  if (provider === "openai") {
    body.n = 1;
    body.size = size;
    body.response_format = "b64_json";
  }

  return body;
}

function extractErrorMessage(text: string): string | null {
  try {
    const j = JSON.parse(text);
    if (j?.error?.message) return j.error.message;
    if (j?.message) return j.message;
  } catch {
    /* not JSON */
  }
  return text.length > 200 ? text.slice(0, 200) + "…" : text || null;
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
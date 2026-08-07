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
 * Strategy: send a tiny streaming ping and resolve as soon as the **first
 * chunk** arrives from the gateway. This is critical for slow proxy gateways
 * (Agnes / LiteLLM) where the full response can take 30s+ but the first
 * token typically arrives within a few seconds — proving the gateway is
 * reachable and authenticated. We never wait for the whole stream.
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

  const url = buildChatURL(provider, baseUrl);
  const start = Date.now();

  try {
    const result = await streamFirstChunk({
      url,
      provider,
      apiKey,
      body: buildPingBody(provider, model),
      timeoutMs: 30_000,
    });

    const latencyMs = Date.now() - start;

    if (result.kind === "first-chunk") {
      return NextResponse.json({
        ok: true,
        latencyMs,
        sample: result.sample,
        endpoint: url,
        mode: "stream",
      });
    }

    if (result.kind === "http-error") {
      return NextResponse.json(
        { ok: false, error: `HTTP ${result.status}: ${result.detail}`, latencyMs, endpoint: url },
        { status: 200 }
      );
    }

    // timeout
    return NextResponse.json(
      {
        ok: false,
        error: `Request timed out after ${latencyMs}ms — gateway never sent a response. Check base URL, API key, or that this model is enabled on the gateway.`,
        latencyMs,
        endpoint: url,
      },
      { status: 200 }
    );
  } catch (e) {
    const latencyMs = Date.now() - start;
    const msg = e instanceof Error ? e.message : "Network error";
    const displayMsg =
      msg === "The operation was aborted" || msg === "This operation was aborted"
        ? `Request timed out after ${latencyMs}ms. The gateway may be slow or unreachable — check your base URL and try again.`
        : msg;
    return NextResponse.json(
      { ok: false, error: displayMsg, latencyMs },
      { status: 200 }
    );
  }
}

type StreamResult =
  | { kind: "first-chunk"; sample: string }
  | { kind: "http-error"; status: number; detail: string }
  | { kind: "timeout" };

/**
 * Open an SSE streaming POST, abort the request as soon as one usable chunk
 * arrives, and return a tiny snippet of the assistant text. This avoids
 * waiting for the full generation and works even when the gateway is slow
 * to start.
 */
async function streamFirstChunk(args: {
  url: string;
  provider: string;
  apiKey: string;
  body: unknown;
  timeoutMs: number;
}): Promise<StreamResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    const resp = await fetch(args.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiKey}`,
        ...(args.provider === "anthropic"
          ? { "x-api-key": args.apiKey, "anthropic-version": "2023-06-01" }
          : {}),
      },
      body: JSON.stringify(args.body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return {
        kind: "http-error",
        status: resp.status,
        detail: extractErrorMessage(text, args.provider) || resp.statusText,
      };
    }

    if (!resp.body) {
      return { kind: "http-error", status: 200, detail: "No response body" };
    }

    // Read the streaming body chunk by chunk until we find the first
    // content token, then abort to free the connection.
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sample = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Anthropic stream: event: content_block_delta \n data: {"delta":{"type":"text_delta","text":"..."}}
        // OpenAI stream: data: {"choices":[{"delta":{"content":"..."}}]}
        if (args.provider === "anthropic") {
          // Anthropic events: each event line "data: {json}" carries delta.text
          const eventMatch = buffer.match(/"type":"content_block_delta"[^\n]*"text":"([^"\\]*)"/);
          if (eventMatch) {
            sample = eventMatch[1].slice(0, 80);
            break;
          }
          // Optional: surface a message_start's error quickly
          if (buffer.includes('"type":"error"')) {
            return { kind: "http-error", status: 400, detail: extractErrorMessage(buffer, args.provider) || "stream error" };
          }
        } else {
          // OpenAI-compat SSE
          const dataMatch = buffer.match(/"content":"((?:[^"\\]|\\.)*)"/);
          if (dataMatch) {
            sample = dataMatch[1]
              .replace(/\\n/g, " ")
              .replace(/\\"/g, '"')
              .slice(0, 80);
            break;
          }
          // Errors sometimes come as a final chunk before [DONE]
          const errMatch = buffer.match(/"error"\s*:\s*\{[^}]*"message"\s*:\s*"([^"]+)"/);
          if (errMatch) {
            return { kind: "http-error", status: 400, detail: errMatch[1] };
          }
        }

        // Safety: if buffer grows huge without a chunk, give up on parsing
        if (buffer.length > 16_000) break;
      }
    } finally {
      // Cancel the underlying TCP read immediately — we got what we need.
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
    }

    if (!sample) sample = "(stream started — no text yet)";
    return { kind: "first-chunk", sample };
  } finally {
    clearTimeout(timer);
  }
}

function buildChatURL(provider: string, baseUrl?: string): string {
  if (provider === "anthropic") {
    const base = (baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
    return `${base}/v1/messages`;
  }
  const base = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  return `${base}/chat/completions`;
}

function buildPingBody(provider: string, model: string): unknown {
  // Keep the body minimal and provider-safe. Non-OpenAI proxies reject
  // OpenAI-only fields such as response_format/logprobs/seed/n/stream_options.
  // We force streaming so we can early-exit on the first chunk.
  if (provider === "anthropic") {
    return {
      model,
      max_tokens: 8,
      messages: [{ role: "user", content: "ping" }],
      stream: true,
    };
  }
  // OpenAI-compatible (openai / deepseek / google / custom / unknown)
  return {
    model,
    max_tokens: 4,
    messages: [{ role: "user", content: "ping" }],
    stream: true,
  };
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
  return text.length > 200 ? text.slice(0, 200) + "…" : text || null;
}
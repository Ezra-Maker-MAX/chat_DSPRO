import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureBotProfile } from "@/lib/bot";

/**
 * POST /api/bot/profile/image-models
 * Body: { provider, apiKey, baseUrl }
 * Returns: { models: [...], source: "live" | "fallback" | "curated", warning? }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const overrides = body && typeof body === "object" ? body : {};

  const profile = await ensureBotProfile(session.tenantId);
  const provider = overrides.provider ?? profile.imageProvider ?? "openai";
  const apiKey = overrides.apiKey ?? profile.imageApiKey;
  const baseUrl = overrides.baseUrl ?? profile.imageBaseUrl ?? undefined;

  if (!apiKey) {
    return NextResponse.json({
      models: DEFAULT_IMAGE_MODELS,
      source: "fallback",
      warning: "No API key on file — showing curated list. Paste your key and click Refresh to load live models.",
    });
  }

  const base = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const url = `${base}/models`;

  try {
    const resp = await fetchWithTimeout(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    }, 12_000);

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return NextResponse.json({
        models: DEFAULT_IMAGE_MODELS,
        source: "fallback",
        warning: `Endpoint returned ${resp.status}: ${text.slice(0, 120)}`,
      });
    }

    const data = await resp.json();
    // Heuristic: filter to image-capable models only
    const ids = (Array.isArray(data?.data) ? data.data : [])
      .map((m: { id?: string }) => m.id)
      .filter((id: string | undefined): id is string => Boolean(id))
      .filter((id: string) =>
        /image|dall|flux|sd-|stable|imagen|midjourney/i.test(id)
      );

    if (ids.length === 0) {
      return NextResponse.json({
        models: DEFAULT_IMAGE_MODELS,
        source: "fallback",
        warning: "Provider didn't expose any image-capable models. Use the curated list or type a custom model id.",
      });
    }
    return NextResponse.json({ models: ids, source: "live" });
  } catch (e) {
    return NextResponse.json({
      models: DEFAULT_IMAGE_MODELS,
      source: "fallback",
      warning: e instanceof Error ? e.message : "Network error",
    });
  }
}

const DEFAULT_IMAGE_MODELS = [
  "gpt-image-1",
  "dall-e-3",
  "dall-e-2",
  "agnes-image-2.1-flash",
  "flux-pro",
  "flux-schnell",
  "stable-diffusion-xl",
  "stable-diffusion-3",
];

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
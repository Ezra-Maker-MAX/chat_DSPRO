import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureBotProfile } from "@/lib/bot";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * GET /api/bot/profile — bot config (no secrets)
 * PUT /api/bot/profile — update bot config (name, prompt, image gateway)
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await ensureBotProfile(session.tenantId);

  return NextResponse.json({
    profile: {
      id: profile.id,
      name: profile.name,
      systemPrompt: profile.systemPrompt,
      roleplaySystemPrompt: profile.roleplaySystemPrompt || "",
      isEnabled: profile.isEnabled,
      imageProvider: profile.imageProvider,
      imageModel: profile.imageModel,
      imageBaseUrl: profile.imageBaseUrl,
      imageCooldownMs: profile.imageCooldownMs,
      imageConfigured: Boolean(profile.imageApiKey),
      lastImageAt: profile.lastImageAt,
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can configure the bot
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const profile = await ensureBotProfile(session.tenantId);

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim().slice(0, 40);
  }
  if (typeof body.systemPrompt === "string") {
    patch.systemPrompt = body.systemPrompt.slice(0, 4000);
  }
  if (typeof body.roleplaySystemPrompt === "string") {
    patch.roleplaySystemPrompt = body.roleplaySystemPrompt.slice(0, 4000);
  }
  if (typeof body.isEnabled === "boolean") {
    patch.isEnabled = body.isEnabled;
  }
  if (typeof body.imageProvider === "string") {
    patch.imageProvider = body.imageProvider.slice(0, 40) || null;
  }
  if (typeof body.imageModel === "string") {
    patch.imageModel = body.imageModel.slice(0, 80) || null;
  }
  if (typeof body.imageBaseUrl === "string") {
    patch.imageBaseUrl = body.imageBaseUrl.slice(0, 300) || null;
  }
  if (typeof body.imageApiKey === "string" && body.imageApiKey.trim()) {
    patch.imageApiKey = body.imageApiKey.trim().slice(0, 300); // do not blank it out
  }
  if (typeof body.imageCooldownMs === "number" && body.imageCooldownMs >= 0) {
    patch.imageCooldownMs = Math.min(Math.max(body.imageCooldownMs, 0), 3600000);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(schema.botProfiles).set(patch).where(eq(schema.botProfiles.id, profile.id));

  const [updated] = await db
    .select()
    .from(schema.botProfiles)
    .where(eq(schema.botProfiles.id, profile.id))
    .limit(1);

  return NextResponse.json({
    profile: {
      id: updated.id,
      name: updated.name,
      systemPrompt: updated.systemPrompt,
      roleplaySystemPrompt: updated.roleplaySystemPrompt || "",
      isEnabled: updated.isEnabled,
      imageProvider: updated.imageProvider,
      imageModel: updated.imageModel,
      imageBaseUrl: updated.imageBaseUrl,
      imageCooldownMs: updated.imageCooldownMs,
      imageConfigured: Boolean(updated.imageApiKey),
      lastImageAt: updated.lastImageAt,
    },
  });
}

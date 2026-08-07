import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "@/lib/password";

/**
 * POST /api/admin/recover
 * Recover (or set) account credentials for a user who knows the INIT_KEY.
 * Useful when an admin or member loses access — they can bootstrap credentials
 * without first needing to log in.
 *
 * Security: requires INIT_KEY (same gate as /api/admin/init). Anyone with that
 * key can reset any user's credentials, so treat INIT_KEY as root-level.
 *
 * Body:
 *   {
 *     key: "<INIT_KEY>",
 *     tenantSlug: "demo-space",
 *     nickname: "念念不忘",         // OR userId, exactly one
 *     newUsername: "niannian",     // ASCII 3-24
 *     newPassword: "newpass123"
 *   }
 *
 * Returns:
 *   { ok: true, userId, username, nickname }
 */
export async function POST(req: NextRequest) {
  const expectedKey = process.env.INIT_KEY;
  if (!expectedKey) {
    return NextResponse.json(
      {
        error:
          "INIT_KEY env var is not set. Add it in Vercel project settings (any random string), then retry.",
      },
      { status: 503 }
    );
  }

  let body: {
    key?: string;
    tenantSlug?: string;
    nickname?: string;
    userId?: string;
    newUsername?: string;
    newPassword?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.key !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized. Provide matching INIT_KEY." }, { status: 401 });
  }

  const tenantSlug = String(body.tenantSlug || "").trim();
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const newUsername = typeof body.newUsername === "string" ? body.newUsername.trim() : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!tenantSlug) return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  if (!nickname && !userId) {
    return NextResponse.json({ error: "Provide either nickname or userId" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]{3,24}$/.test(newUsername)) {
    return NextResponse.json(
      { error: "newUsername must be 3-24 characters (letters, numbers, _ or -)" },
      { status: 400 }
    );
  }
  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "newPassword must be at least 6 characters" },
      { status: 400 }
    );
  }

  // Resolve tenant
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, tenantSlug.toLowerCase()))
    .limit(1);
  if (!tenant) {
    return NextResponse.json({ error: `Space '${tenantSlug}' not found` }, { status: 404 });
  }

  // Find target user
  let target;
  if (userId) {
    const rows = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.id, userId), eq(schema.users.tenantId, tenant.id)))
      .limit(1);
    target = rows[0];
  } else {
    const rows = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.tenantId, tenant.id), eq(schema.users.nickname, nickname)))
      .limit(1);
    target = rows[0];
  }
  if (!target) {
    return NextResponse.json(
      { error: "User not found in this space (check tenantSlug + nickname)" },
      { status: 404 }
    );
  }

  // Make sure newUsername isn't taken by ANOTHER user in the same tenant
  const collisions = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, newUsername));
  const takenByOther = collisions.find((u) => u.tenantId === tenant.id && u.id !== target.id);
  if (takenByOther) {
    return NextResponse.json(
      { error: `Username '${newUsername}' is already taken by another user in this space` },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(schema.users)
    .set({ username: newUsername, passwordHash })
    .where(eq(schema.users.id, target.id));

  return NextResponse.json({
    ok: true,
    userId: target.id,
    nickname: target.nickname,
    username: newUsername,
    tenantSlug: tenant.slug,
    note: "You can now log in with this username + password at /login",
  });
}

// Also allow GET for quick browser-based trigger (key passed via ?key=)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const initBody = {
    key: url.searchParams.get("key") || "",
    tenantSlug: url.searchParams.get("tenantSlug") || "",
    nickname: url.searchParams.get("nickname") || "",
    userId: url.searchParams.get("userId") || "",
    newUsername: url.searchParams.get("newUsername") || "",
    newPassword: url.searchParams.get("newPassword") || "",
  };
  const proxyReq = new NextRequest(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(initBody),
  });
  return POST(proxyReq);
}
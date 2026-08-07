import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

// GET /api/admin/users — list all members of the space (admin only)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await db
    .select({
      id: schema.users.id,
      nickname: schema.users.nickname,
      role: schema.users.role,
      username: schema.users.username,
      hasAccount: schema.users.passwordHash,
      isOnline: schema.users.isOnline,
      lastSeen: schema.users.lastSeen,
    })
    .from(schema.users)
    .where(eq(schema.users.tenantId, session.tenantId));

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      hasAccount: Boolean(u.username && u.hasAccount),
    })),
  });
}

// POST /api/admin/users — admin sets/updates OR clears a member's account credentials
// body: { userId, username?, password?, clear? }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || "");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Target must be in the same tenant
  const [target] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!target || target.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Clear account
  if (body.clear) {
    await db
      .update(schema.users)
      .set({ username: null, passwordHash: null })
      .where(eq(schema.users.id, userId));
    return NextResponse.json({ success: true });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!/^[a-zA-Z0-9_-]{3,24}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-24 characters (letters, numbers, _ or -)" },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username));
  const takenByOther = existing.find(
    (u) => u.tenantId === session.tenantId && u.id !== userId
  );
  if (takenByOther) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  await db
    .update(schema.users)
    .set({ username, passwordHash })
    .where(eq(schema.users.id, userId));

  return NextResponse.json({ success: true });
}

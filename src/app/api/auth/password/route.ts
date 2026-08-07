import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

// POST /api/auth/password — set or change YOUR OWN account credentials (username + password)
// Requires an active session. body: { username, password }
// This lets any member (including the admin) convert their invite-only identity into an
// account they can log back into with a password.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  // Username: 3-24 chars, alphanumeric + _-
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

  // Ensure username is not taken within this tenant
  const existing = await db
    .select()
    .from(schema.users)
    .where(
      eq(schema.users.username, username)
    );

  const takenByOther = existing.find(
    (u) => u.tenantId === session.tenantId && u.id !== session.userId
  );
  if (takenByOther) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  await db
    .update(schema.users)
    .set({ username, passwordHash })
    .where(eq(schema.users.id, session.userId));

  return NextResponse.json({ success: true });
}

// GET /api/auth/password — whether the current user already has an account
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);
  return NextResponse.json({
    hasAccount: Boolean(user?.username && user?.passwordHash),
    username: user?.username || null,
  });
}

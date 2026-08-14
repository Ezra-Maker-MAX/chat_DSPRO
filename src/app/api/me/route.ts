import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * GET /api/me — current user info (id, nickname, role, adultEnabled).
 * The sidebar uses this to decide whether to show the 18+ entry.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      id: schema.users.id,
      nickname: schema.users.nickname,
      role: schema.users.role,
      adultEnabled: schema.users.adultEnabled,
    })
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isAdmin = user.role === "admin";
  return NextResponse.json({
    user: {
      id: user.id,
      nickname: user.nickname,
      role: user.role || "member",
      adultEnabled: isAdmin ? true : !!user.adultEnabled,
    },
  });
}

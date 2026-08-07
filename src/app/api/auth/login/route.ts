import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { signToken, setSessionCookie, hashToken } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

// POST /api/auth/login — log in with username + password (account-based)
// body: { tenantSlug, username, password }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { tenantSlug, username, password } = body;

    if (!tenantSlug || !username || !password) {
      return NextResponse.json(
        { error: "Tenant, username and password are required" },
        { status: 400 }
      );
    }

    // Resolve tenant by slug
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.slug, String(tenantSlug).toLowerCase()))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    // Find user by username (unique per tenant)
    const [user] = await db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.tenantId, tenant.id),
          eq(schema.users.username, String(username).trim())
        )
      )
      .limit(1);

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const ok = await verifyPassword(String(password), user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Issue session
    const token = await signToken({
      userId: user.id,
      tenantId: tenant.id,
      nickname: user.nickname,
      role: user.role || "member",
    });
    await db
      .update(schema.users)
      .set({ tokenHash: await hashToken(token) })
      .where(eq(schema.users.id, user.id));

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      user: {
        id: user.id,
        nickname: user.nickname,
        role: user.role || "member",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

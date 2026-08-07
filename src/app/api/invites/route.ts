import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createInviteCode } from "@/lib/invites";

// POST /api/invites — admin generates a new invite code for the current space
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can generate invite codes
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Only admins can invite others" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const singleUse = Boolean(body.singleUse);
  const maxUses = typeof body.maxUses === "number" ? body.maxUses : null;
  const expiresInHours =
    typeof body.expiresInHours === "number" && body.expiresInHours > 0
      ? body.expiresInHours
      : null;

  // Verify the tenant exists
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, session.tenantId))
    .limit(1);
  if (!tenant) {
    return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }

  const result = await createInviteCode({
    tenantId: tenant.id,
    createdBy: session.userId,
    singleUse,
    maxUses: maxUses ?? undefined,
    expiresInHours: expiresInHours ?? undefined,
  });

  return NextResponse.json({
    success: true,
    invite: {
      code: result.code,
      singleUse,
      maxUses,
      expiresAt: result.expiresAt,
    },
  });
}

// GET /api/invites — admin lists active invite codes for the space
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invites = await db
    .select()
    .from(schema.inviteCodes)
    .where(eq(schema.inviteCodes.tenantId, session.tenantId))
    .orderBy(schema.inviteCodes.createdAt);

  return NextResponse.json({
    invites: invites.map((i) => ({
      id: i.id,
      code: i.code,
      singleUse: i.singleUse,
      usedCount: i.usedCount,
      maxUses: i.maxUses,
      expiresAt: i.expiresAt,
      isActive: i.isActive,
      createdAt: i.createdAt,
    })),
  });
}

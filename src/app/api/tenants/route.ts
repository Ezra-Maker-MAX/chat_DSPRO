import { NextRequest, NextResponse } from "next/server";
import { getSession, signToken, setSessionCookie, hashToken } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createTenant } from "@/lib/invites";
import { generateId } from "@/lib/utils";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, session.tenantId))
    .limit(1);

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Count online members
  const onlineCount = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.tenantId, session.tenantId))
    .then((users) => users.filter((u) => u.isOnline).length);

  // Get channels
  const channels = await db
    .select()
    .from(schema.channels)
    .where(eq(schema.channels.tenantId, session.tenantId));

  return NextResponse.json({
    tenant: {
      ...tenant,
      onlineCount,
    },
    channels,
  });
}

// POST /api/tenants — create a brand-new independent space, then sign the creator in
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : "";
  const description = typeof body.description === "string" ? body.description : "";

  const result = await createTenant({
    name,
    description,
    createdByUserId: session.userId,
    createdByNickname: session.nickname,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // The creator needs an admin session in the NEW space. Sign a token for them.
  // Look up the admin user we just created.
  const [admin] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.tenantId, result.tenantId))
    .limit(1);

  const token = await signToken({
    userId: admin.id,
    tenantId: result.tenantId,
    nickname: session.nickname,
    role: "admin",
  });

  await db
    .update(schema.users)
    .set({ tokenHash: await hashToken(token) })
    .where(eq(schema.users.id, admin.id));

  await setSessionCookie(token);

  return NextResponse.json({
    success: true,
    tenant: {
      id: result.tenantId,
      slug: result.slug,
      name: result.name,
      code: result.code,
    },
  });
}

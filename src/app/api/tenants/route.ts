import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

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

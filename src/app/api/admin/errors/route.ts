import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/admin/errors — recent frontend error telemetry (admin only).
 * DELETE /api/admin/errors — clear the log for this tenant.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 50));

  const rows = await db
    .select({
      id: schema.appErrors.id,
      type: schema.appErrors.type,
      message: schema.appErrors.message,
      stack: schema.appErrors.stack,
      url: schema.appErrors.url,
      createdAt: schema.appErrors.createdAt,
    })
    .from(schema.appErrors)
    .where(eq(schema.appErrors.tenantId, session.tenantId))
    .orderBy(desc(schema.appErrors.createdAt))
    .limit(limit);

  return NextResponse.json({ errors: rows });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await db
    .delete(schema.appErrors)
    .where(eq(schema.appErrors.tenantId, session.tenantId));
  return NextResponse.json({ ok: true });
}

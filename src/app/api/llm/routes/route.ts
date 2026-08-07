import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const routes = await db
    .select()
    .from(schema.llmRoutes)
    .where(eq(schema.llmRoutes.tenantId, session.tenantId));

  return NextResponse.json({ routes });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { name, providerId, condition, priority } = body;

  if (!name || !providerId) {
    return NextResponse.json({ error: "name and providerId are required" }, { status: 400 });
  }

  const id = `rt_${generateId(12)}`;

  await db.insert(schema.llmRoutes).values({
    id,
    tenantId: session.tenantId,
    name,
    providerId,
    condition: condition || "*",
    priority: priority || 0,
  });

  return NextResponse.json({ success: true, id });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await db
    .delete(schema.llmRoutes)
    .where(
      and(
        eq(schema.llmRoutes.id, id),
        eq(schema.llmRoutes.tenantId, session.tenantId)
      )
    );

  return NextResponse.json({ success: true });
}

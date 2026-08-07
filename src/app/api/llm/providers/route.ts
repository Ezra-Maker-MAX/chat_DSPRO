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

  const providers = await db
    .select({
      id: schema.llmProviders.id,
      name: schema.llmProviders.name,
      provider: schema.llmProviders.provider,
      model: schema.llmProviders.model,
      baseUrl: schema.llmProviders.baseUrl,
      isActive: schema.llmProviders.isActive,
      createdAt: schema.llmProviders.createdAt,
    })
    .from(schema.llmProviders)
    .where(eq(schema.llmProviders.tenantId, session.tenantId));

  return NextResponse.json({ providers });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, provider, model, apiKey, baseUrl } = body;

  if (!name || !provider || !model || !apiKey) {
    return NextResponse.json({ error: "name, provider, model, and apiKey are required" }, { status: 400 });
  }

  const id = `llm_${generateId(12)}`;

  await db.insert(schema.llmProviders).values({
    id,
    tenantId: session.tenantId,
    name,
    provider,
    model,
    apiKey, // In production, encrypt this
    baseUrl: baseUrl || null,
  });

  // Auto-create a catch-all route so /chat works immediately. Users can add
  // more specific regex routes (e.g. "/coding") later via the routes UI.
  const existingRoutes = await db
    .select({ id: schema.llmRoutes.id })
    .from(schema.llmRoutes)
    .where(
      and(
        eq(schema.llmRoutes.tenantId, session.tenantId),
        eq(schema.llmRoutes.isActive, true)
      )
    )
    .limit(1);

  if (existingRoutes.length === 0) {
    await db.insert(schema.llmRoutes).values({
      id: `rt_${generateId(12)}`,
      tenantId: session.tenantId,
      name: `${name} (default)`,
      providerId: id,
      condition: "*",
      priority: 0,
      isActive: true,
    });
  }

  return NextResponse.json({ success: true, id });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await db
    .delete(schema.llmProviders)
    .where(
      and(
        eq(schema.llmProviders.id, id),
        eq(schema.llmProviders.tenantId, session.tenantId)
      )
    );

  return NextResponse.json({ success: true });
}

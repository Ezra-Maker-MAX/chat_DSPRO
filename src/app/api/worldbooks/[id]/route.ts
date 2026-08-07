import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getWorldBook,
  saveWorldBookEntry,
  deleteWorldBookEntry,
} from "@/lib/roleplay";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/worldbooks/[id] — book + entries
 * POST /api/worldbooks/[id]/entries — add entry
 * Body: { keys: string[], content, insertionOrder?, enabled?, priority?, position? }
 * DELETE /api/worldbooks/[id]/entries?entryId=... — remove entry
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const book = await getWorldBook(session.tenantId, id);
  if (!book) {
    return NextResponse.json({ error: "World book not found" }, { status: 404 });
  }
  return NextResponse.json(book);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const [wb] = await db
    .select()
    .from(schema.worldBooks)
    .where(
      and(
        eq(schema.worldBooks.id, id),
        eq(schema.worldBooks.tenantId, session.tenantId)
      )
    )
    .limit(1);
  if (!wb) {
    return NextResponse.json({ error: "World book not found" }, { status: 404 });
  }
  if (session.role !== "admin" && wb.createdBy !== session.userId) {
    return NextResponse.json({ error: "Admin only or creator only" }, { status: 403 });
  }

  const body = await req.json();
  const keys = Array.isArray(body.keys) ? body.keys.map((k: string) => String(k).slice(0, 60)) : [];
  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: "Entry content is required" }, { status: 400 });
  }

  const entryId = await saveWorldBookEntry(id, {
    keys,
    content: content.slice(0, 4000),
    insertionOrder: body.insertionOrder,
    enabled: body.enabled ?? true,
    priority: body.priority,
    position: body.position === "after_char" ? "after_char" : "before_char",
  });

  return NextResponse.json({ success: true, id: entryId });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const entryId = searchParams.get("entryId");
  if (!entryId) {
    return NextResponse.json({ error: "entryId required" }, { status: 400 });
  }

  const [wb] = await db
    .select()
    .from(schema.worldBooks)
    .where(
      and(
        eq(schema.worldBooks.id, id),
        eq(schema.worldBooks.tenantId, session.tenantId)
      )
    )
    .limit(1);
  if (!wb) {
    return NextResponse.json({ error: "World book not found" }, { status: 404 });
  }
  if (session.role !== "admin" && wb.createdBy !== session.userId) {
    return NextResponse.json({ error: "Admin only or creator only" }, { status: 403 });
  }

  await deleteWorldBookEntry(entryId);
  return NextResponse.json({ success: true });
}

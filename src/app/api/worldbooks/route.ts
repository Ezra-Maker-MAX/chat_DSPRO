import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createWorldBook,
  listWorldBooks,
  getWorldBook,
  saveWorldBookEntry,
  deleteWorldBookEntry,
} from "@/lib/roleplay";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/worldbooks — list world books
 * POST /api/worldbooks — create one { name, description? }
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const books = await listWorldBooks(session.tenantId);
  return NextResponse.json({ books });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const name = body.name?.trim();
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "A name (≤60 chars) is required" }, { status: 400 });
  }
  const id = await createWorldBook(session.tenantId, session.userId, name, body.description);
  return NextResponse.json({ success: true, id });
}

/** DELETE /api/worldbooks?id=... — remove a book (admin or creator). */
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

  // Unlink from characters, delete entries, delete book
  await db
    .update(schema.characterCards)
    .set({ worldBookId: null })
    .where(eq(schema.characterCards.worldBookId, id));
  await db.delete(schema.worldBookEntries).where(eq(schema.worldBookEntries.worldBookId, id));
  await db.delete(schema.worldBooks).where(eq(schema.worldBooks.id, id));

  return NextResponse.json({ success: true });
}

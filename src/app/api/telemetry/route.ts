import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { generateId } from "@/lib/utils";

/**
 * POST /api/telemetry — silent frontend error reporting.
 * Body: { type: "error"|"unhandledrejection"|"console", message?, stack?, url? }
 * Stored with session context for admin review. Never fails the client:
 * all validation is lenient, storage errors are swallowed.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: true });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const entries = Array.isArray(body.batch) ? (body.batch as Record<string, unknown>[]) : [body];
  const TYPES = new Set(["error", "unhandledrejection", "console"]);
  const norm = (e: Record<string, unknown>) => ({
    type: TYPES.has(String(e.type)) ? String(e.type) : "error",
    message: typeof e.message === "string" ? e.message.slice(0, 1000) : "",
    stack: typeof e.stack === "string" ? e.stack.slice(0, 4000) : null,
    url: typeof e.url === "string" ? e.url.slice(0, 500) : null,
  });

  try {
    for (const raw of entries.slice(0, 10)) {
      const { type, message, stack, url } = norm(raw);
      if (!message) continue;
      await db.insert(schema.appErrors).values({
        id: `err_${generateId(16)}`,
        tenantId: session.tenantId,
        userId: session.userId,
        type,
        message: message || null,
        stack,
        url,
      });
    }
  } catch {
    /* telemetry must never break the app */
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { INIT_SQL } from "@/lib/db/init.sql";

/**
 * POST /api/init
 * Idempotent database init. Run once after first deploy.
 *
 * Protect: must pass the same INIT_KEY you set in Vercel env vars.
 * If INIT_KEY is not set, defaults to a fixed value (DEV ONLY).
 *
 * Usage:
 *   curl -X POST https://your-app.vercel.app/api/init \
 *     -H "Content-Type: application/json" \
 *     -d '{"key":"your-init-key"}'
 *
 * Returns:
 *   { ok: true, steps: N, demoInviteCode: "DEMO-CODE-1234" }
 */
export async function POST(req: NextRequest) {
  // SECURITY: require INIT_KEY to be explicitly set in env.
  // Will not run with a default value — user must opt in by adding the env var.
  const expectedKey = process.env.INIT_KEY;
  if (!expectedKey) {
    return NextResponse.json(
      {
        error:
          "INIT_KEY env var is not set. Add it in Vercel project settings (any random string), then retry.",
      },
      { status: 503 }
    );
  }

  // Accept key from body, header, or query string
  let providedKey = "";
  try {
    const body = await req.json().catch(() => ({}));
    providedKey = body.key || "";
  } catch {
    // ignore
  }
  if (!providedKey) providedKey = req.headers.get("x-init-key") || "";
  if (!providedKey) {
    const url = new URL(req.url);
    providedKey = url.searchParams.get("key") || "";
  }

  if (providedKey !== expectedKey) {
    return NextResponse.json(
      { error: "Unauthorized. Provide matching INIT_KEY." },
      { status: 401 }
    );
  }

  const steps: string[] = [];
  const errors: string[] = [];

  for (const sql of INIT_SQL) {
    try {
      await db.run(sql as Parameters<typeof db.run>[0]);
      steps.push("ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${sql.slice(0, 60)}... => ${msg}`);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    steps: steps.length,
    total: INIT_SQL.length,
    errors: errors.length ? errors : undefined,
    demoInviteCode: "DEMO-CODE-1234",
  });
}

// Also allow GET for quick browser-based trigger
export async function GET(req: NextRequest) {
  return POST(req);
}

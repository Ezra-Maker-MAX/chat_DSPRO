import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { DEFAULT_PRICING, upsertPricing } from "@/lib/pricing";

/**
 * GET /api/billing/pricing — list this tenant's pricing rules + defaults.
 * PUT /api/billing/pricing — upsert a rule (admin only).
 * Body: { provider, model?, inputCentsPer1m?, outputCentsPer1m?, imageCentsPerUnit? }
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rules = await db
    .select()
    .from(schema.tenantPricing)
    .where(eq(schema.tenantPricing.tenantId, session.tenantId));

  return NextResponse.json({
    rules: rules.map((r) => ({
      provider: r.provider,
      model: r.model,
      inputCentsPer1m: r.inputCentsPer1m ?? 0,
      outputCentsPer1m: r.outputCentsPer1m ?? 0,
      imageCentsPerUnit: r.imageCentsPerUnit ?? 0,
    })),
    defaults: DEFAULT_PRICING,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const provider = String(body.provider || "").trim();
  if (!provider) {
    return NextResponse.json({ error: "provider required" }, { status: 400 });
  }
  const model = String(body.model || "default").trim() || "default";

  const clamp = (v: unknown, max = 100000) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
  };

  await upsertPricing(
    session.tenantId,
    provider,
    model,
    clamp(body.inputCentsPer1m),
    clamp(body.outputCentsPer1m),
    clamp(body.imageCentsPerUnit)
  );

  return NextResponse.json({ success: true });
}

import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";

/**
 * 分模型定价（盈利模式）。
 *
 * Selling price = upstream cost × markup. Defaults below are the *selling*
 * rates (CNY cents per 1M tokens) charged to the tenant's credit balance.
 * Admins can override per provider+model via /api/billing/pricing; a
 * `default` row per provider acts as a fallback when no exact model rule
 * exists.
 *
 * Reference upstream costs (¥ per 1M tokens):
 *   deepseek-chat       2 / 8
 *   deepseek-reasoner   4 / 16
 *   gpt-4o-mini         1.2 / 4.8
 *   gpt-4o              15 / 60
 *   claude-sonnet       20 / 100
 *   gemini-flash        2.5 / 15
 *   custom (assumed)    3 / 12
 * Images: gpt-image-1 ≈ ¥15-40 per image; default selling ¥20.
 */
export const DEFAULT_PRICING: Record<
  string,
  { input: number; output: number; image: number }
> = {
  deepseek: { input: 300, output: 1300, image: 0 }, // 3/13 ¥/M (deepseek-chat 2/8 ×1.3, rounded)
  openai: { input: 2000, output: 8000, image: 2000 }, // gpt-4o-ish; ¥20/张图
  anthropic: { input: 2600, output: 13000, image: 0 },
  google: { input: 400, output: 2000, image: 0 },
  custom: { input: 400, output: 1600, image: 2000 },
};

export interface PriceRule {
  provider: string;
  model: string;
  inputCentsPer1m: number;
  outputCentsPer1m: number;
  imageCentsPerUnit: number;
}

/** Look up the effective price rule for a provider+model (exact → "default" → DEFAULT_PRICING). */
export async function getPricing(
  tenantId: string,
  provider: string,
  model: string
): Promise<PriceRule> {
  const rows = await db
    .select()
    .from(schema.tenantPricing)
    .where(eq(schema.tenantPricing.tenantId, tenantId));

  const exact = rows.find((r) => r.provider === provider && r.model === model);
  const wildcard = rows.find((r) => r.provider === provider && r.model === "default");
  const rule = exact || wildcard;

  if (rule) {
    return {
      provider,
      model: rule.model,
      inputCentsPer1m: rule.inputCentsPer1m ?? 0,
      outputCentsPer1m: rule.outputCentsPer1m ?? 0,
      imageCentsPerUnit: rule.imageCentsPerUnit ?? 0,
    };
  }

  const fallback = DEFAULT_PRICING[provider] || DEFAULT_PRICING.custom;
  return {
    provider,
    model: "default",
    inputCentsPer1m: fallback.input,
    outputCentsPer1m: fallback.output,
    imageCentsPerUnit: fallback.image,
  };
}

/** Charge the tenant for a token usage. Prices are selling rates (cents). */
export async function chargeTokens(
  tenantId: string,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  opts?: { adminFree?: boolean }
) {
  // Admins are never charged — their usage comes with the space.
  if (opts?.adminFree) return 0;
  const rule = await getPricing(tenantId, provider, model);
  const costCents =
    Math.ceil(((inputTokens || 0) / 1_000_000) * rule.inputCentsPer1m) +
    Math.ceil(((outputTokens || 0) / 1_000_000) * rule.outputCentsPer1m);
  if (costCents <= 0) return 0;

  const [bal] = await db
    .select()
    .from(schema.tenantBalances)
    .where(eq(schema.tenantBalances.tenantId, tenantId))
    .limit(1);
  if (!bal) return 0;

  const next = Math.max(0, (bal.balanceCents ?? 0) - costCents);
  await db
    .update(schema.tenantBalances)
    .set({ balanceCents: next, updatedAt: new Date().toISOString() })
    .where(eq(schema.tenantBalances.id, bal.id));
  return costCents;
}

/** Charge the tenant for one generated image. */
export async function chargeImage(
  tenantId: string,
  provider: string,
  model: string,
  count = 1
) {
  const rule = await getPricing(tenantId, provider, model);
  const costCents = (rule.imageCentsPerUnit || 0) * count;
  if (costCents <= 0) return 0;

  const [bal] = await db
    .select()
    .from(schema.tenantBalances)
    .where(eq(schema.tenantBalances.tenantId, tenantId))
    .limit(1);
  if (!bal) return 0;

  const next = Math.max(0, (bal.balanceCents ?? 0) - costCents);
  await db
    .update(schema.tenantBalances)
    .set({ balanceCents: next, updatedAt: new Date().toISOString() })
    .where(eq(schema.tenantBalances.id, bal.id));
  return costCents;
}

/** Upsert one pricing rule (admin setting). */
export async function upsertPricing(
  tenantId: string,
  provider: string,
  model: string,
  inputCentsPer1m: number,
  outputCentsPer1m: number,
  imageCentsPerUnit: number
) {
  const existing = await db
    .select()
    .from(schema.tenantPricing)
    .where(
      and(
        eq(schema.tenantPricing.tenantId, tenantId),
        eq(schema.tenantPricing.provider, provider),
        eq(schema.tenantPricing.model, model)
      )
    )
    .limit(1);

  const values = {
    inputCentsPer1m,
    outputCentsPer1m,
    imageCentsPerUnit,
  };

  if (existing[0]) {
    await db
      .update(schema.tenantPricing)
      .set(values)
      .where(eq(schema.tenantPricing.id, existing[0].id));
    return existing[0].id;
  }
  const id = `tp_${provider}_${model}_${tenantId.slice(-8)}`;
  await db.insert(schema.tenantPricing).values({
    id,
    tenantId,
    provider,
    model,
    ...values,
  });
  return id;
}

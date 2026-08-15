import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";

/** DeepSeek 官方充值页（微信/支付宝扫码）。前端用它生成二维码或跳转。 */
export const DEEPSEEK_TOP_UP_URL = "https://platform.deepseek.com/top_up";

/** 可选的充值面额（元）。 */
export const RECHARGE_AMOUNTS = [10, 20, 50, 100, 300, 500];

/**
 * GET https://api.deepseek.com/user/balance
 * Returns the DeepSeek account's current topped-up balance (CNY, as string).
 * Used to verify that a user actually paid before crediting the tenant.
 */
export async function getDeepSeekBalance(apiKey: string): Promise<{
  totalBalance: number;
  toppedUpBalance: number;
  isAvailable: boolean;
} | null> {
  try {
    const res = await fetch("https://api.deepseek.com/user/balance", {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const cny = (data.balance_infos || []).find(
      (b: { currency?: string }) => b.currency === "CNY"
    );
    return {
      totalBalance: parseFloat(cny?.total_balance ?? "0") || 0,
      toppedUpBalance: parseFloat(cny?.topped_up_balance ?? "0") || 0,
      isAvailable: !!data.is_available,
    };
  } catch {
    return null;
  }
}

/** Find the tenant's active DeepSeek provider (needed for balance checks). */
export async function findDeepSeekProvider(tenantId: string) {
  const providers = await db
    .select()
    .from(schema.llmProviders)
    .where(eq(schema.llmProviders.tenantId, tenantId));
  return (
    providers.find((p) => p.provider === "deepseek" && p.isActive) || null
  );
}

/** Get (create if needed) the tenant's credit balance row. */
export async function ensureTenantBalance(
  tenantId: string,
  opts?: { adminFree?: boolean }
) {
  // Admins bypass the credit gate entirely — they operate the space and
  // shouldn't be blocked by their own prepaid balance.
  if (opts?.adminFree) {
    return {
      id: "admin-bypass",
      tenantId,
      balanceCents: 999_999_999,
      updatedAt: null,
    } as typeof schema.tenantBalances.$inferSelect;
  }
  const [existing] = await db
    .select()
    .from(schema.tenantBalances)
    .where(eq(schema.tenantBalances.tenantId, tenantId))
    .limit(1);
  if (existing) return existing;
  const id = `tb_${generateId(16)}`;
  await db.insert(schema.tenantBalances).values({ id, tenantId, balanceCents: 0 });
  const [created] = await db
    .select()
    .from(schema.tenantBalances)
    .where(eq(schema.tenantBalances.id, id))
    .limit(1);
  return created;
}

/**
 * Create a recharge order. Snapshot the DeepSeek topped-up balance *before* the
 * user pays, so confirmRecharge can detect the delta caused by their payment.
 * Returns { orderId, deepseekBalance } — deepseekBalance may be null if the
 * provider key is missing/invalid (order still created, verification best-effort).
 */
export async function createRechargeOrder(
  tenantId: string,
  userId: string,
  amountCents: number
) {
  const orderId = `rech_${generateId(16)}`;
  const provider = await findDeepSeekProvider(tenantId);
  let before: number | null = null;
  if (provider) {
    const bal = await getDeepSeekBalance(provider.apiKey);
    before = bal?.toppedUpBalance ?? null;
  }
  await db.insert(schema.rechargeOrders).values({
    id: orderId,
    tenantId,
    userId,
    amountCents,
    status: "pending",
    deepseekBefore: before !== null ? String(before) : null,
  });
  return { orderId, deepseekBalance: before };
}

/**
 * Verify a pending recharge order by re-checking the DeepSeek balance.
 * If the topped-up balance increased by at least the order amount since the
 * order was created, credit the tenant and mark the order confirmed.
 *
 * Idempotent: confirmed orders are never re-credited. Retrying a pending order
 * is safe — if the user hasn't paid yet, we simply return not-yet-confirmed.
 */
export async function confirmRecharge(orderId: string) {
  const [order] = await db
    .select()
    .from(schema.rechargeOrders)
    .where(eq(schema.rechargeOrders.id, orderId))
    .limit(1);
  if (!order) return { ok: false, error: "Order not found" };
  if (order.status === "confirmed") {
    const bal = await ensureTenantBalance(order.tenantId);
    return { ok: true, alreadyConfirmed: true, balanceCents: bal.balanceCents };
  }

  const provider = await findDeepSeekProvider(order.tenantId);
  if (!provider) {
    return { ok: false, error: "No DeepSeek provider configured" };
  }

  const current = await getDeepSeekBalance(provider.apiKey);
  if (!current) {
    return { ok: false, error: "Failed to query DeepSeek balance" };
  }

  const before = parseFloat(order.deepseekBefore || "0");
  const delta = current.toppedUpBalance - before;
  const minDelta = order.amountCents / 100;

  if (delta < minDelta - 0.01) {
    // Not paid yet (or payment below the requested amount). Keep pending.
    await db
      .update(schema.rechargeOrders)
      .set({ deepseekAfter: String(current.toppedUpBalance) })
      .where(eq(schema.rechargeOrders.id, orderId));
    return { ok: false, pending: true, error: "Payment not detected yet" };
  }

  // Paid — credit the tenant with the *requested* amount (not the raw delta,
  // so overpayment stays on the DeepSeek account as user credit).
  const balance = await ensureTenantBalance(order.tenantId);
  const credited = Math.round(order.amountCents);
  await db
    .update(schema.tenantBalances)
    .set({
      balanceCents: (balance.balanceCents ?? 0) + credited,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.tenantBalances.id, balance.id));

  await db
    .update(schema.rechargeOrders)
    .set({
      status: "confirmed",
      deepseekAfter: String(current.toppedUpBalance),
      confirmedAt: new Date().toISOString(),
    })
    .where(eq(schema.rechargeOrders.id, orderId));

  const updated = await ensureTenantBalance(order.tenantId);
  return { ok: true, credited, balanceCents: updated.balanceCents };
}

/**
 * Check whether a tenant still has credit. Returns the balance in cents.
 * A balance <= 0 means LLM calls should be blocked (and the UI should prompt
 * the user to recharge).
 */
export async function getTenantBalance(tenantId: string): Promise<number> {
  const bal = await ensureTenantBalance(tenantId);
  return bal.balanceCents ?? 0;
}

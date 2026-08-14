import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  DEEPSEEK_TOP_UP_URL,
  RECHARGE_AMOUNTS,
  confirmRecharge,
  createRechargeOrder,
  ensureTenantBalance,
  findDeepSeekProvider,
  getDeepSeekBalance,
  getTenantBalance,
} from "@/lib/deepseek-billing";

/**
 * GET /api/billing/status — tenant credit balance + DeepSeek top-up info.
 * Any logged-in member may view; recharge is shared per tenant.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const balanceCents = await getTenantBalance(session.tenantId);
  const provider = await findDeepSeekProvider(session.tenantId);
  let deepseek: { totalBalance: number; toppedUpBalance: number } | null = null;
  if (provider) {
    const bal = await getDeepSeekBalance(provider.apiKey);
    if (bal) {
      deepseek = { totalBalance: bal.totalBalance, toppedUpBalance: bal.toppedUpBalance };
    }
  }

  return NextResponse.json({
    balanceCents,
    balanceYuan: (balanceCents / 100).toFixed(2),
    topUpUrl: DEEPSEEK_TOP_UP_URL,
    amounts: RECHARGE_AMOUNTS,
    deepseekConfigured: !!provider,
    deepseek,
  });
}

/**
 * POST /api/billing/recharge — create a recharge order.
 * Body: { amount } — amount in CNY yuan (int, ≥ 1).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
    return NextResponse.json({ error: "amount must be 1..100000 CNY" }, { status: 400 });
  }

  const { orderId, deepseekBalance } = await createRechargeOrder(
    session.tenantId,
    session.userId,
    amount * 100
  );

  return NextResponse.json({
    success: true,
    orderId,
    topUpUrl: DEEPSEEK_TOP_UP_URL,
    amountCents: amount * 100,
    deepseekBalance,
  });
}

/**
 * POST /api/billing/confirm — verify payment against DeepSeek balance delta
 * and credit the tenant. Body: { orderId }.
 */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const result = await confirmRecharge(orderId);
  if (result.ok) {
    return NextResponse.json({
      success: true,
      balanceCents: result.balanceCents,
      balanceYuan: ((result.balanceCents ?? 0) / 100).toFixed(2),
      alreadyConfirmed: !!result.alreadyConfirmed,
    });
  }
  const status = result.pending ? 202 : 400;
  return NextResponse.json({ error: result.error }, { status });
}

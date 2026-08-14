import { NextRequest, NextResponse } from "next/server";
import { cleanupInactiveUsers } from "@/lib/user-cleanup";

/**
 * GET /api/cron/cleanup — Vercel Cron 每天调用，删除超过 7 天未登录的账号。
 *
 * 鉴权：Vercel Cron 会在请求头带上 `Authorization: Bearer <CRON_SECRET>`。
 * 仅接受该 secret，防止任何人手动触发批量删除。
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await cleanupInactiveUsers();
  return NextResponse.json({ ok: true, deleted, count: deleted.length });
}

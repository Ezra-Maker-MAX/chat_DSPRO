import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { cleanupInactiveUsers } from "@/lib/user-cleanup";

/**
 * POST /api/admin/cleanup — 管理员手动触发：删除超过 7 天未登录的账号。
 * 可用于即时测试 / 兜底（Vercel Cron 每天 4 点也会自动跑）。
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deleted = await cleanupInactiveUsers();
  return NextResponse.json({ ok: true, deleted, count: deleted.length });
}

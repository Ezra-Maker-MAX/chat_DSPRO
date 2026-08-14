import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

/** 非活跃判定阈值：7 天（毫秒）。 */
export const INACTIVE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 删除超过 7 天未登录的账号。
 *
 * 规则：
 *  - 仅删除 role = 'member' 的用户（admin / 空间创建者永不自动删除）
 *  - 跳过 bot 用户（id 以 bot_ 开头）
 *  - lastSeen 为空时按 createdAt 计算
 *  - 同步删除该用户的角色扮演会话（私人数据）
 *  - 消息记录保留（避免破坏聊天记录；前端对已删除用户做兜底展示）
 *
 * 返回被删除的用户 id 列表。
 */
export async function cleanupInactiveUsers(): Promise<string[]> {
  const now = Date.now();

  // 全量 member 在内存里判断（数据量级小，且能正确处理 null lastSeen）
  const members = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, "member"));

  const toDelete: typeof members = [];
  for (const u of members) {
    if (u.id.startsWith("bot_")) continue;
    const lastSeen = u.lastSeen || u.createdAt;
    if (!lastSeen) continue;
    const ts = new Date(lastSeen).getTime();
    if (!Number.isFinite(ts)) continue;
    if (now - ts > INACTIVE_MS) toDelete.push(u);
  }

  const ids = toDelete.map((u) => u.id);
  if (ids.length === 0) return [];

  // 删除角色扮演会话（用户私人数据）
  for (const id of ids) {
    await db
      .delete(schema.roleplaySessions)
      .where(eq(schema.roleplaySessions.userId, id));
  }

  // 删除用户行
  for (const id of ids) {
    await db.delete(schema.users).where(eq(schema.users.id, id));
  }

  return ids;
}

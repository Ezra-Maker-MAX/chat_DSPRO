import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getImageQueueStatus, processNextImageJob } from "@/lib/bot";
import { db, schema } from "@/lib/db";
import { eq, and, asc } from "drizzle-orm";

/**
 * GET /api/bot/imagine/queue
 * Returns queue status + job list. Also lazily processes the next queued job
 * so images flow without a background worker.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Lazy processing: try to advance the queue on each poll
  await processNextImageJob();

  const status = await getImageQueueStatus(session.tenantId);

  const jobs = await db
    .select({
      id: schema.botImageJobs.id,
      prompt: schema.botImageJobs.prompt,
      status: schema.botImageJobs.status,
      imageUrl: schema.botImageJobs.imageUrl,
      error: schema.botImageJobs.error,
      createdAt: schema.botImageJobs.createdAt,
      nickname: schema.users.nickname,
    })
    .from(schema.botImageJobs)
    .leftJoin(schema.users, eq(schema.botImageJobs.requestedBy, schema.users.id))
    .where(eq(schema.botImageJobs.tenantId, session.tenantId))
    .orderBy(asc(schema.botImageJobs.createdAt))
    .limit(20);

  return NextResponse.json({ status, jobs });
}

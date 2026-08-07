import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { registerSubscriber } from "@/lib/sse";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get("channelId");

  if (!channelId) {
    return new Response("channelId required", { status: 400 });
  }

  // Verify channel belongs to tenant
  const [channel] = await db
    .select()
    .from(schema.channels)
    .where(
      and(
        eq(schema.channels.id, channelId),
        eq(schema.channels.tenantId, session.tenantId)
      )
    )
    .limit(1);

  if (!channel) {
    return new Response("Channel not found", { status: 404 });
  }

  // Mark user as online
  await db
    .update(schema.users)
    .set({ isOnline: true, lastSeen: new Date().toISOString() })
    .where(eq(schema.users.id, session.userId));

  const encoder = new TextEncoder();
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ userId: session.userId })}\n\n`)
      );

      // Register subscriber
      const send = (data: string) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch {
            // stream closed
          }
        }
      };
      const unregister = registerSubscriber(channelId, send);

      // Heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            clearInterval(heartbeat);
          }
        }
      }, 15000);

      // Cleanup on close
      req.signal.addEventListener("abort", () => {
        isClosed = true;
        clearInterval(heartbeat);
        unregister();
        // Mark user offline
        db.update(schema.users)
          .set({ isOnline: false, lastSeen: new Date().toISOString() })
          .where(eq(schema.users.id, session.userId))
          .run()
          .catch(() => {});
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

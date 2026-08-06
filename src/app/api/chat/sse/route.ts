import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, gt } from "drizzle-orm";

// In-memory subscription registry (per-process, not scalable across instances)
// For production, use Redis pub/sub or a service like Pusher/Ably
const subscribers = new Map<string, Set<(data: string) => void>>();

export function broadcastToChannel(channelId: string, data: object) {
  const subs = subscribers.get(channelId);
  if (subs) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    subs.forEach((send) => send(payload));
  }
}

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
      if (!subscribers.has(channelId)) {
        subscribers.set(channelId, new Set());
      }
      const send = (data: string) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch {
            // stream closed
          }
        }
      };
      subscribers.get(channelId)!.add(send);

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
        subscribers.get(channelId)?.delete(send);
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

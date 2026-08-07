// In-memory subscription registry for SSE (per-process).
// NOTE: not scalable across serverless instances; for production use Redis/pub-sub.

const subscribers = new Map<string, Set<(data: string) => void>>();

export function broadcastToChannel(channelId: string, data: object) {
  const subs = subscribers.get(channelId);
  if (subs) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    subs.forEach((send) => send(payload));
  }
}

export function registerSubscriber(channelId: string, send: (data: string) => void): () => void {
  if (!subscribers.has(channelId)) {
    subscribers.set(channelId, new Set());
  }
  subscribers.get(channelId)!.add(send);
  return () => {
    subscribers.get(channelId)?.delete(send);
  };
}

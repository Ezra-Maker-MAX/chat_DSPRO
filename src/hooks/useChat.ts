"use client";

import { useState, useEffect, useCallback } from "react";

interface Message {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  userId: string;
  nickname: string;
  avatarSeed: string;
  media?: unknown[];
}

export function useRealtimeChat(channelId: string, currentUserId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // Fetch history
  useEffect(() => {
    if (!channelId) return;
    setLoading(true);
    fetch(`/api/chat/messages?channelId=${channelId}&limit=50`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages || []))
      .finally(() => setLoading(false));
  }, [channelId]);

  // SSE
  useEffect(() => {
    if (!channelId) return;
    const es = new EventSource(`/api/chat/sse?channelId=${channelId}`);

    es.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "new_message" && data.message.userId !== currentUserId) {
          setMessages((prev) => [...prev, data.message]);
        }
      } catch {}
    });

    return () => es.close();
  }, [channelId, currentUserId]);

  const sendMessage = useCallback(
    async (content: string, mediaIds: string[] = []) => {
      const tempId = `temp_${Date.now()}`;
      const optimistic: Message = {
        id: tempId,
        content,
        type: mediaIds.length > 0 ? "media" : "text",
        createdAt: new Date().toISOString(),
        userId: currentUserId,
        nickname: "You",
        avatarSeed: "you",
      };

      setMessages((prev) => [...prev, optimistic]);

      try {
        const res = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId, content, mediaIds }),
        });
        const data = await res.json();
        if (data.message) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? data.message : m))
          );
        }
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    },
    [channelId, currentUserId]
  );

  return { messages, loading, onlineUsers, sendMessage };
}

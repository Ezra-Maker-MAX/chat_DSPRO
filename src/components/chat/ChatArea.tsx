"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import { useI18n } from "@/lib/i18n";
import { Loader2 } from "lucide-react";

interface Message {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  userId: string;
  nickname: string;
  avatarSeed: string;
  media?: { id: string; storageUrl: string; mediaType: string; fileName: string; mimeType: string }[];
}

interface Props {
  channelId: string;
  channelName: string;
  currentUserId: string;
  allowMedia: boolean;
  allowVoice: boolean;
}

export default function ChatArea({
  channelId,
  channelName,
  currentUserId,
  allowMedia,
  allowVoice,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const { t } = useI18n();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Mirror of `messages` so the polling interval can read the latest id
  // without re-creating itself every time messages changes.
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Fetch initial messages
  useEffect(() => {
    if (!channelId) return;
    setLoading(true);
    fetch(`/api/chat/messages?channelId=${channelId}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages || []);
        setHasMore(data.hasMore);
      })
      .finally(() => setLoading(false));
  }, [channelId]);

  // SSE subscription for real-time (works only when the SSE connection and the
  // bot happen to land on the same serverless instance — see src/lib/sse.ts).
  useEffect(() => {
    if (!channelId) return;

    const eventSource = new EventSource(`/api/chat/sse?channelId=${channelId}`);

    eventSource.addEventListener("connected", (e) => {
      console.log("SSE connected:", JSON.parse(e.data));
    });

    eventSource.addEventListener("message", (e) => {
      // Used for custom events from broadcast
      try {
        const data = JSON.parse(e.data);
        if (data.type === "new_message") {
          setMessages((prev) =>
            prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
          );
        }
      } catch {}
    });

    eventSource.onerror = () => {
      // Reconnect automatically (SSE does this natively with a small delay)
    };

    return () => {
      eventSource.close();
    };
  }, [channelId]);

  // Polling fallback — fixes the cross-serverless-instance problem where the
  // SSE pub-sub is in-memory and the bot reply never reaches the client.
  // Polls every 4s when the tab is visible; dedupes by message id so it
  // coexists safely with SSE (whichever delivers first wins).
  useEffect(() => {
    if (!channelId) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      if (document.hidden) return; // pause when tab is hidden
      const latestId = messagesRef.current[messagesRef.current.length - 1]?.id;
      if (!latestId) return;
      try {
        const r = await fetch(
          `/api/chat/messages?channelId=${channelId}&since=${encodeURIComponent(latestId)}&limit=50`
        );
        if (!r.ok) return;
        const data = await r.json();
        const newOnes: Message[] = data.messages || [];
        if (newOnes.length === 0) return;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const merged = [...prev];
          for (const m of newOnes) if (!seen.has(m.id)) merged.push(m);
          return merged;
        });
      } catch {
        /* ignore transient network errors */
      }
    };

    timer = setInterval(tick, 4000);
    // Also tick immediately on mount to recover from any missed messages
    const startTimer = setTimeout(tick, 500);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (startTimer) clearTimeout(startTimer);
    };
  }, [channelId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = useCallback(
    async (content: string, mediaIds: string[]) => {
      // Slash commands: route to the bot, still show the user's command message
      if (content.trim().startsWith("/") && mediaIds.length === 0) {
        // Post the command as a normal message first
        const res = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId, content, type: "text", mediaIds: [] }),
        });
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);
        }
        // Fire the bot command handler (replies arrive via SSE)
        fetch("/api/bot/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId, content }),
        }).catch(() => {});
        return;
      }

      // Optimistic add
      const tempId = `temp_${Date.now()}`;
      const optimistic: Message = {
        id: tempId,
        content,
        type: mediaIds.length > 0 ? "media" : "text",
        createdAt: new Date().toISOString(),
        userId: currentUserId,
        nickname: "You",
        avatarSeed: "you",
        media: mediaIds.map((id) => ({
          id,
          storageUrl: "",
          mediaType: "image",
          fileName: "",
          mimeType: "",
        })),
      };

      setMessages((prev) => [...prev, optimistic]);

      try {
        const res = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId, content, type: mediaIds.length > 0 ? "media" : "text", mediaIds }),
        });
        const data = await res.json();
        if (data.message) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...data.message, media: m.media } : m))
          );
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    },
    [channelId, currentUserId]
  );

  return (
    <div className="flex-1 flex flex-col h-dvh">
      {/* Channel header */}
      <div className="h-[var(--topbar-h)] border-b border-[var(--color-border)] flex items-center px-5 bg-[var(--color-bg-base)] shrink-0">
        <div className="flex items-center gap-2 md:ml-0 ml-12">
          <span className="text-lg text-[var(--color-text-muted)]">#</span>
          <h2 className="font-[family-name:var(--font-display)] font-semibold text-base">
            {channelName}
          </h2>
        </div>
      </div>

      {/* Messages area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto py-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] gap-2">
            <div className="text-4xl">💬</div>
            <p className="text-sm">{t("chat.noMessages")}</p>
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="text-center py-2">
                <button className="text-xs text-[var(--color-accent)] hover:underline">
                  {t("chat.loadEarlier")}
                </button>
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.userId === currentUserId}
              />
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        channelId={channelId}
        onSend={handleSend}
        allowMedia={allowMedia}
        allowVoice={allowVoice}
      />
    </div>
  );
}

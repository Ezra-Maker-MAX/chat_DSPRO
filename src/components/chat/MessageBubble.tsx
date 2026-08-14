"use client";

import { formatTime } from "@/lib/utils";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
interface Media {
  id: string;
  storageUrl: string;
  mediaType: "image" | "audio" | "video";
  fileName: string;
  mimeType: string;
}

interface Message {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  userId: string;
  nickname: string;
  avatarSeed: string;
  media?: Media[];
  replyToId?: string | null;
  targetUserId?: string | null;
  /** Hydrated by GET /api/chat/messages — the snippet of the message this one replies to. */
  replyTo?: { content: string; nickname: string; type: string } | null;
}

interface Props {
  message: Message;
  isOwn: boolean;
  onReply?: (msg: Message) => void;
}

function Avatar({ seed, nickname }: { seed: string; nickname: string }) {
  const isBot = seed.startsWith("bot_") || nickname.toLowerCase().includes("bot");
  // Deterministic color from seed
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const initial = nickname.charAt(0).toUpperCase();

  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 font-[family-name:var(--font-display)]"
      style={
        isBot
          ? {
              background:
                "linear-gradient(135deg, var(--color-teal), var(--color-accent))",
              color: "white",
              boxShadow: "0 0 12px rgba(0,210,210,0.35)",
            }
          : {
              background: `linear-gradient(135deg, hsl(${hue}, 60%, 45%), hsl(${hue + 30}, 50%, 35%))`,
              color: "white",
            }
      }
    >
      {isBot ? "🤖" : initial}
    </div>
  );
}

/** Compact preview of a message that this one is replying to. */
function ReplyPreview({ replyTo, isBot }: { replyTo: NonNullable<Message["replyTo"]>; isBot: boolean }) {
  const replyIsBot = replyTo.nickname.toLowerCase().includes("bot");
  const previewText =
    replyTo.type === "image" ? "🖼 图片" :
    replyTo.type === "audio" ? "🎤 语音" :
    replyTo.type === "video" ? "🎬 视频" :
    replyTo.content || "(空)";
  return (
    <div
      className={`mb-1 px-2.5 py-1 rounded-md border-l-2 text-[11px] leading-snug max-w-full ${
        isBot
          ? "bg-[var(--color-bg-elevated)]/60 border-[var(--color-teal)] text-[var(--color-text-muted)]"
          : "bg-[var(--color-bg-elevated)] border-[var(--color-accent)]/60 text-[var(--color-text-muted)]"
      }`}
    >
      <span className="font-medium text-[var(--color-text-secondary)]">
        {replyIsBot ? "🤖" : "@"}{replyTo.nickname}
      </span>
      <span className="ml-1.5 truncate align-middle">{previewText}</span>
    </div>
  );
}

export default function MessageBubble({ message, isOwn, onReply }: Props) {
  const [imgError, setImgError] = useState<Record<string, boolean>>({});
  const { t } = useI18n();

  if (message.type === "system") {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-[var(--color-text-muted)] px-3 py-1 rounded-full bg-[var(--color-bg-elevated)]">
          {message.content}
        </span>
      </div>
    );
  }

  const isBot = message.userId.startsWith("bot_") || message.avatarSeed?.startsWith("bot_");

  return (
    <div
      className={`group/bubble flex gap-3 px-4 py-1.5 animate-message-in relative ${
        isOwn ? "flex-row-reverse" : ""
      }`}
      style={{ animationDelay: "0s" }}
    >
      {!isOwn && <Avatar seed={message.avatarSeed} nickname={message.nickname} />}

      <div className={`flex flex-col max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
        {!isOwn && (
          <span className="text-xs text-[var(--color-text-muted)] mb-1 px-1">
            {message.nickname}
          </span>
        )}

        {/* Reply preview (above media + bubble) */}
        {message.replyTo && <ReplyPreview replyTo={message.replyTo} isBot={isBot} />}

        {/* Media content */}
        {message.media?.map((m) => (
          <div key={m.id} className="mb-1 rounded-xl overflow-hidden max-w-sm">
            {m.mediaType === "image" && !imgError[m.id] && (
              <img
                src={m.storageUrl}
                alt={m.fileName}
                className="max-h-64 w-auto rounded-xl object-cover"
                loading="lazy"
                onError={() => setImgError((p) => ({ ...p, [m.id]: true }))}
              />
            )}
            {m.mediaType === "audio" && (
              <audio controls className="h-10 w-48">
                <source src={m.storageUrl} type={m.mimeType} />
              </audio>
            )}
            {m.mediaType === "video" && (
              <video controls className="max-h-64 w-auto rounded-xl" preload="metadata">
                <source src={m.storageUrl} type={m.mimeType} />
              </video>
            )}
          </div>
        ))}

        {/* Text content */}
        {message.content && (
          <div
            className={`
              px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words
              ${
                isOwn
                  ? "bg-[var(--color-accent)] text-white rounded-tr-md"
                  : isBot
                    ? "bg-[var(--color-teal-muted)] border border-[var(--color-teal)]/20 text-[var(--color-text-primary)] rounded-tl-md"
                    : "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] rounded-tl-md"
              }
            `}
          >
            {message.content}
          </div>
        )}

        <span className="text-[10px] text-[var(--color-text-muted)] mt-1 px-1">
          {formatTime(message.createdAt)}
        </span>
      </div>

      {isOwn && <Avatar seed={message.avatarSeed} nickname={message.nickname} />}

      {/* Hover menu — Reply */}
      {onReply && (
        <button
          type="button"
          aria-label={t("chat.reply.aria")}
          onClick={(e) => {
            e.stopPropagation();
            onReply(message);
          }}
          className={`absolute top-1/2 -translate-y-1/2 ${
            isOwn ? "left-2" : "right-2"
          } opacity-0 group-hover/bubble:opacity-100 transition-opacity text-[10px] px-2 py-1 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent-glow)] shadow-sm`}
        >
          ↩ {t("chat.reply.aria")}
        </button>
      )}
    </div>
  );
}

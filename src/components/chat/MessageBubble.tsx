"use client";

import { formatTime } from "@/lib/utils";
import { useState } from "react";
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
}

interface Props {
  message: Message;
  isOwn: boolean;
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

export default function MessageBubble({ message, isOwn }: Props) {
  const [imgError, setImgError] = useState<Record<string, boolean>>({});

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
      className={`flex gap-3 px-4 py-1.5 animate-message-in ${
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
    </div>
  );
}

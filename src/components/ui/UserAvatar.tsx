"use client";

import { useState } from "react";

/**
 * Shared user avatar: custom URL if set, otherwise a deterministic
 * gradient + initial generated from the avatar seed (same algorithm
 * as chat bubbles). Handles broken image fallback.
 */
export default function UserAvatar({
  seed,
  nickname,
  url,
  size = 32,
  className = "",
}: {
  seed: string;
  nickname: string;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={nickname}
        width={size}
        height={size}
        className={`${className} shrink-0 rounded-full object-cover`}
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  // Deterministic color from seed (mirrors MessageBubble's Avatar).
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const initial = (nickname || "?").charAt(0).toUpperCase();

  return (
    <div
      className={`${className} shrink-0 rounded-full flex items-center justify-center font-bold font-[family-name:var(--font-display)]`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.38)),
        background: `linear-gradient(135deg, hsl(${hue}, 60%, 45%), hsl(${hue + 30}, 50%, 35%))`,
        color: "white",
      }}
    >
      {initial}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Hash,
  Plus,
  Gamepad2,
  Settings,
  LogOut,
  Users,
  MessageSquare,
} from "lucide-react";

interface Channel {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
}

interface SidebarProps {
  tenantSlug: string;
  tenantName: string;
  channels: Channel[];
  onlineCount: number;
  currentChannelId?: string;
  userRole: string;
}

export default function Sidebar({
  tenantSlug,
  tenantName,
  channels,
  onlineCount,
  currentChannelId,
  userRole,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const isActive = (channelId: string) => channelId === currentChannelId;

  return (
    <aside className="w-[var(--sidebar-w)] h-screen flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-base)] shrink-0">
      {/* Tenant header */}
      <div className="px-5 py-4 border-b border-[var(--color-border)]">
        <h1
          className="font-[family-name:var(--font-display)] font-bold text-lg tracking-tight truncate"
          style={{
            background: "linear-gradient(135deg, var(--color-accent), var(--color-teal))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {tenantName}
        </h1>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-2 h-2 rounded-full bg-[var(--color-teal)]" />
          <span className="text-xs text-[var(--color-text-muted)]">
            {onlineCount} online
          </span>
        </div>
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            Channels
          </span>
          {userRole === "admin" && (
            <button className="p-1 rounded-md hover:bg-[var(--color-bg-hover)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
              <Plus size={14} />
            </button>
          )}
        </div>

        <nav className="space-y-0.5">
          {channels.map((channel) => (
            <Link
              key={channel.id}
              href={`/${tenantSlug}/channels/${channel.id}`}
              className={`
                flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150
                ${
                  isActive(channel.id)
                    ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-glow)] font-medium"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                }
              `}
            >
              <Hash size={15} className="shrink-0" />
              <span className="truncate">{channel.name}</span>
              {channel.isDefault && (
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-accent-glow)] font-medium">
                  MAIN
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      {/* Bottom nav */}
      <div className="px-3 py-3 border-t border-[var(--color-border)] space-y-1">
        <Link
          href={`/${tenantSlug}/games`}
          className={`
            flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150
            ${
              pathname.includes("/games")
                ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-glow)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            }
          `}
        >
          <Gamepad2 size={16} />
          Game Plaza
        </Link>

        {userRole === "admin" && (
          <Link
            href={`/${tenantSlug}/settings`}
            className={`
              flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150
              ${
                pathname.includes("/settings")
                  ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-glow)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              }
            `}
          >
            <Settings size={16} />
            Settings
          </Link>
        )}

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 w-full text-left text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-danger)]"
        >
          <LogOut size={16} />
          {isLoggingOut ? "Leaving..." : "Leave Space"}
        </button>
      </div>
    </aside>
  );
}

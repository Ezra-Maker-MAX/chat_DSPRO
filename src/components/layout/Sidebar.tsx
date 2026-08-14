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
  UserPlus,
  Sparkles,
  HeartCrack,
  Pencil,
} from "lucide-react";
import InviteModal from "./InviteModal";
import NewSpaceModal from "./NewSpaceModal";
import LanguageSwitcher from "./LanguageSwitcher";
import UserAvatar from "@/components/ui/UserAvatar";
import UserProfileModal from "@/components/profile/UserProfileModal";
import { useI18n } from "@/lib/i18n";

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
  nickname?: string;
  avatarSeed?: string;
  userRole: string;
  adultEnabled?: boolean;
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  tenantSlug,
  tenantName,
  channels,
  onlineCount,
  currentChannelId,
  nickname = "",
  avatarSeed = "",
  userRole,
  adultEnabled = false,
  open = false,
  onClose,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showNewSpace, setShowNewSpace] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const isActive = (channelId: string) => channelId === currentChannelId;

  return (
    <aside
      className={`w-[var(--sidebar-w)] h-dvh flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-base)] shrink-0 fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
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
            {t("sidebar.online", { count: onlineCount })}
          </span>
        </div>
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            {t("sidebar.channels")}
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
              onClick={onClose}
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
        {userRole === "admin" && (
          <button
            onClick={() => { setShowInvite(true); onClose?.(); }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 w-full text-left text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-accent-glow)]"
          >
            <UserPlus size={16} />
            {t("sidebar.invite")}
          </button>
        )}

        <button
          onClick={() => { setShowNewSpace(true); onClose?.(); }}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 w-full text-left text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-teal)]"
        >
          <Sparkles size={16} />
          {t("sidebar.newSpace")}
        </button>

        <Link
          href={`/${tenantSlug}/games`}
          onClick={onClose}
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
          {t("sidebar.games")}
        </Link>

        {(userRole === "admin" || adultEnabled) && (
        <Link
          href={`/${tenantSlug}/adult`}
          onClick={onClose}
          className={`
            flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150
            ${
              pathname.includes("/adult")
                ? "bg-[var(--color-danger)]/15 text-[var(--color-danger)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
            }
          `}
        >
          <HeartCrack size={16} />
          <span className="flex-1">{t("sidebar.adult")}</span>
          <span className="rounded bg-[var(--color-danger)]/20 px-1.5 py-0.5 text-[9px] font-bold text-[var(--color-danger)]">
            18+
          </span>
        </Link>
        )}

        <Link
          href={`/${tenantSlug}/settings`}
          onClick={onClose}
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
          {t("sidebar.settings")}
        </Link>

        <button
          onClick={() => { handleLogout(); onClose?.(); }}
          disabled={isLoggingOut}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 w-full text-left text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-danger)]"
        >
          <LogOut size={16} />
          {isLoggingOut ? t("sidebar.leaving") : t("sidebar.leave")}
        </button>

        {/* Language switcher */}
        <div className="pt-1 border-t border-[var(--color-border)]">
          <LanguageSwitcher />
        </div>

        {/* User zone — SFW profile entry */}
        <div className="mt-1 border-t border-[var(--color-border)] px-2 pt-2">
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-[var(--color-bg-hover)] transition-colors"
            title={t("profile.edit")}
          >
            <UserAvatar seed={avatarSeed || "usr_default"} nickname={nickname || "?"} size={34} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {nickname || t("profile.unknown")}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)]">
                {userRole === "admin" ? t("profile.roleAdmin") : t("profile.roleMember")}
              </div>
            </div>
            <span className="shrink-0 rounded-lg border border-[var(--color-border)] p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors">
              <Pencil size={12} />
            </span>
          </button>
        </div>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      {showNewSpace && <NewSpaceModal onClose={() => setShowNewSpace(false)} />}
      <UserProfileModal mode="sfw" open={profileOpen} onClose={() => setProfileOpen(false)} />
    </aside>
  );
}

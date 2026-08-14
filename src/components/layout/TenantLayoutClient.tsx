"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import ParticleBackground from "./ParticleBackground";
import { LayoutContextProvider } from "./LayoutContext";
import { Menu } from "lucide-react";

interface Channel {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean | null;
}

interface Props {
  tenantSlug: string;
  tenantName: string;
  channels: Channel[];
  onlineCount: number;
  userId: string;
  nickname: string;
  avatarSeed: string;
  userRole: string;
  adultEnabled: boolean;
  allowMedia: boolean;
  allowVoice: boolean;
  allowVideo: boolean;
  children: React.ReactNode;
}

export default function TenantLayoutClient({
  tenantSlug,
  tenantName,
  channels,
  onlineCount,
  userId,
  nickname,
  avatarSeed,
  userRole,
  adultEnabled,
  children,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const openSidebar = () => setSidebarOpen(true);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <LayoutContextProvider value={{ openSidebar, userId, nickname, userRole }}>
      <div className="flex h-dvh overflow-hidden relative">
        <ParticleBackground accentColor="267, 75%, 65%" particleCount={20} />

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        <Sidebar
          tenantSlug={tenantSlug}
          tenantName={tenantName}
          channels={channels.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            isDefault: c.isDefault ?? false,
          }))}
          onlineCount={onlineCount}
          nickname={nickname}
          avatarSeed={avatarSeed}
          userRole={userRole}
          adultEnabled={adultEnabled}
          open={sidebarOpen}
          onClose={closeSidebar}
        />

        {/* Mobile hamburger — only visible below md */}
        <button
          onClick={openSidebar}
          className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-[var(--color-bg-card)]/90 backdrop-blur border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors md:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <main className="flex-1 relative z-10 overflow-hidden">
          {children}
        </main>
      </div>
    </LayoutContextProvider>
  );
}

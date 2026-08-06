"use client";

import Sidebar from "./Sidebar";
import ParticleBackground from "./ParticleBackground";

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
  userRole: string;
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
  userRole,
  children,
}: Props) {
  return (
    <div className="flex h-screen overflow-hidden relative">
      <ParticleBackground accentColor="267, 75%, 65%" particleCount={20} />

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
        userRole={userRole}
      />

      <main className="flex-1 relative z-10 overflow-hidden">
        {children}
      </main>
    </div>
  );
}

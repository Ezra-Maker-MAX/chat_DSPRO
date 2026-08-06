"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ParticleBackground from "@/components/layout/ParticleBackground";
import { ArrowRight, Sparkles, Users, Shield, Gamepad2, Cpu } from "lucide-react";

interface Session {
  tenantSlug: string;
  channelId: string | null;
  tenantName: string;
}

export default function LandingClient({ session }: { session: Session | null }) {
  const router = useRouter();
  const [typedText, setTypedText] = useState("");
  const fullText = "anonymous spaces that matter";

  useEffect(() => {
    if (session?.channelId) {
      router.push(`/${session.tenantSlug}/channels/${session.channelId}`);
      return;
    }
    if (session?.tenantSlug) {
      router.push(`/${session.tenantSlug}`);
      return;
    }
  }, [session, router]);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 60);
    return () => clearInterval(interval);
  }, []);

  if (session?.tenantSlug) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <ParticleBackground accentColor="267, 75%, 65%" particleCount={50} />

      {/* Hero */}
      <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
        {/* Logo mark */}
        <div className="mb-8 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-accent-muted)] border border-[var(--color-accent)]/20">
          <Sparkles size={28} className="text-[var(--color-accent-glow)]" />
        </div>

        {/* Headline */}
        <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-6xl font-bold tracking-tight mb-4">
          <span
            style={{
              background: "linear-gradient(135deg, var(--color-accent-glow), var(--color-teal))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Chatmosphere
          </span>
        </h1>

        <p className="text-xl text-[var(--color-text-secondary)] mb-2 font-light h-8">
          <span>{typedText}</span>
          <span className="animate-pulse text-[var(--color-accent)]">|</span>
        </p>

        <p className="text-sm text-[var(--color-text-muted)] mb-10 max-w-md mx-auto">
          Private, invite-only chat spaces with media sharing, built-in games, and multi-model AI.
          No tracking. No sharing. Just conversation.
        </p>

        {/* CTA */}
        <Link
          href="/join"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-medium text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-glow)] hover:shadow-[0_0_30px_rgba(108,92,231,0.3)] transition-all duration-300 font-[family-name:var(--font-display)]"
        >
          Enter with invite code
          <ArrowRight size={18} />
        </Link>

        {/* Feature capsules */}
        <div className="mt-16 flex flex-wrap justify-center gap-3">
          {[
            { icon: Users, label: "Multi-tenant" },
            { icon: Shield, label: "Invite-only" },
            { icon: Gamepad2, label: "Game Plaza" },
            { icon: Cpu, label: "Multi-Model AI" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)]/50 text-sm text-[var(--color-text-secondary)]"
            >
              <Icon size={14} className="text-[var(--color-accent)]" />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-xs text-[var(--color-text-muted)]">
        Built for Vercel + Turso · Open source
      </div>
    </main>
  );
}

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ParticleBackground from "@/components/layout/ParticleBackground";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="relative min-h-screen flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
        </main>
      }
    >
      <JoinForm />
    </Suspense>
  );
}

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [inviteCode, setInviteCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Prefill invite code from ?code= param (e.g. a shared join link)
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setInviteCode(formatCode(code));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const formatCode = (value: string) => {
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (cleaned.length <= 4) return cleaned;
    if (cleaned.length <= 8) return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`;
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!inviteCode.trim() || !nickname.trim()) {
      setError(t("join.error.both"));
      return;
    }

    if (nickname.length < 2 || nickname.length > 20) {
      setError(t("join.error.nickname"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode, nickname }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      router.push(`/${data.tenant.slug}`);
    } catch {
      setError(t("join.error.network"));
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <ParticleBackground accentColor="267, 75%, 65%" particleCount={30} />

      {/* Language switcher */}
      <div className="absolute top-4 right-4 z-20 w-40">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mb-8 transition-colors"
        >
          <ArrowLeft size={16} />
          {t("join.back")}
        </Link>

        {/* Card */}
        <div className="glass-card p-8 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-muted)] flex items-center justify-center">
              <Sparkles size={18} className="text-[var(--color-accent-glow)]" />
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-bold text-xl">
              {t("join.title")}
            </h1>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            {/* Invite code */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                {t("join.invite.label")}
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(formatCode(e.target.value))}
                placeholder={t("join.invite.placeholder")}
                maxLength={14}
                className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm font-mono tracking-[0.3em] text-center text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                autoFocus
              />
            </div>

            {/* Nickname */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                {t("join.nickname.label")}
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t("join.nickname.placeholder")}
                maxLength={20}
                className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
                {t("join.nickname.hint")}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-sm text-[var(--color-danger)]">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-accent flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("join.submitting")}
                </>
              ) : (
                t("join.submit")
              )}
            </button>
          </form>

          <p className="text-xs text-[var(--color-text-muted)] mt-6 text-center">
            {t("join.noCode")}
          </p>
        </div>
      </div>
    </main>
  );
}

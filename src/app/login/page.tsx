"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ParticleBackground from "@/components/layout/ParticleBackground";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="relative min-h-screen flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [tenantSlug, setTenantSlug] = useState(searchParams.get("space") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSpace, setLastSpace] = useState<{ slug: string; name: string } | null>(null);

  // Pre-fill slug from localStorage (remembered on last successful join)
  useEffect(() => {
    if (searchParams.get("space")) return; // explicit ?space= wins
    try {
      const raw = localStorage.getItem("ch_last_space");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.slug) {
          setTenantSlug(parsed.slug);
          setLastSpace({ slug: parsed.slug, name: parsed.name || parsed.slug });
        }
      }
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!tenantSlug.trim() || !username.trim() || !password) {
      setError(t("login.error.required"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          username,
          password,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      // Remember this space for next time
      try {
        localStorage.setItem(
          "ch_last_space",
          JSON.stringify({ slug: data.tenant.slug, name: data.tenant.name })
        );
      } catch {
        /* ignore */
      }

      router.push(`/${data.tenant.slug}`);
    } catch {
      setError(t("login.error.network"));
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
          {t("login.back")}
        </Link>

        {/* Card */}
        <div className="glass-card p-8 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-muted)] flex items-center justify-center">
              <ShieldCheck size={18} className="text-[var(--color-accent-glow)]" />
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-bold text-xl">
              {t("login.title")}
            </h1>
          </div>

          <p className="text-xs text-[var(--color-text-muted)] mb-5">
            {t("login.subtitle")}
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Last-space reminder (helps returning users find their slug) */}
            {lastSpace && !tenantSlug.startsWith(lastSpace.slug) && (
              <button
                type="button"
                onClick={() => setTenantSlug(lastSpace.slug)}
                className="w-full text-left p-3 rounded-lg bg-[var(--color-accent-muted)]/40 border border-[var(--color-accent)]/20 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-muted)]/70 transition-colors"
              >
                <span className="text-[var(--color-text-muted)]">{t("login.lastSpacePrefix")}</span>{" "}
                <span className="font-medium text-[var(--color-text-primary)]">{lastSpace.name}</span>{" "}
                <span className="font-mono text-[var(--color-accent-glow)]">({lastSpace.slug})</span>
              </button>
            )}

            {/* Space slug */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                {t("login.space.label")}
              </label>
              <input
                type="text"
                value={tenantSlug}
                onChange={(e) =>
                  setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                placeholder={t("login.space.placeholder")}
                maxLength={40}
                className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm font-mono text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                autoFocus
              />
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
                {t("login.space.hint")}
              </p>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                {t("login.username.label")}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("login.username.placeholder")}
                maxLength={24}
                autoComplete="username"
                className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                {t("login.password.label")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
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
                  {t("login.submitting")}
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  {t("login.submit")}
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-[var(--color-text-muted)] mt-6 text-center">
            {t("login.noAccount")}{" "}
            <Link
              href="/join"
              className="text-[var(--color-accent-glow)] hover:underline"
            >
              {t("login.goJoin")}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

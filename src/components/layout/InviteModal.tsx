"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { X, Copy, Check, RefreshCw, Link2, UserPlus } from "lucide-react";

interface InviteModalProps {
  onClose: () => void;
}

export default function InviteModal({ onClose }: InviteModalProps) {
  const { t } = useI18n();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [singleUse, setSingleUse] = useState(false);
  const [maxUses, setMaxUses] = useState<number | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ singleUse, maxUses }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("invite.error.gen"));
        return;
      }
      setCode(data.invite.code);
    } catch {
      setError(t("invite.error.network"));
    } finally {
      setLoading(false);
    }
  }, [singleUse, maxUses, t]);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const joinUrl = code
    ? `${window.location.origin}/join?code=${encodeURIComponent(code)}`
    : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-[fade-in_0.2s_ease]">
        {/* Top accent bar */}
        <div className="h-1 rounded-t-2xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-teal)]" />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-muted)] flex items-center justify-center text-[var(--color-accent-glow)]">
                <UserPlus size={20} />
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-lg text-[var(--color-text-primary)]">
                  {t("invite.title")}
                </h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {t("invite.subtitle")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Options */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setSingleUse(false)}
              className={`px-3 py-2.5 rounded-xl border text-sm transition-all duration-150 ${
                !singleUse
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent-glow)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              }`}
            >
              <div className="font-medium">{t("invite.unlimited")}</div>
              <div className="text-[11px] opacity-80">{t("invite.unlimited.desc")}</div>
            </button>
            <button
              onClick={() => setSingleUse(true)}
              className={`px-3 py-2.5 rounded-xl border text-sm transition-all duration-150 ${
                singleUse
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent-glow)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              }`}
            >
              <div className="font-medium">{t("invite.onetime")}</div>
              <div className="text-[11px] opacity-80">{t("invite.onetime.desc")}</div>
            </button>
          </div>

          {/* Generate button or result */}
          {!code ? (
            <button
              onClick={generate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-glow)] hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Link2 size={16} />
              )}
              {loading ? t("invite.generating") : t("invite.generate")}
            </button>
          ) : (
            <div className="space-y-3">
              {/* Code display */}
              <div className="relative">
                <div className="flex items-center justify-center gap-3 px-4 py-4 rounded-xl border border-dashed border-[var(--color-accent)] bg-[var(--color-accent-muted)]">
                  <span className="font-[family-name:var(--font-mono)] text-2xl md:text-3xl font-medium tracking-widest text-[var(--color-accent-glow)]">
                    {code}
                  </span>
                </div>
                <button
                  onClick={copy}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-bg-elevated)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent-glow)] transition-colors"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-[var(--color-success)]" />
                      <span className="text-[var(--color-success)]">{t("invite.copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      {t("invite.copy")}
                    </>
                  )}
                </button>
              </div>

              {/* Share link */}
              {joinUrl && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(joinUrl!);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    } catch {}
                  }}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] text-left hover:border-[var(--color-border-light)] transition-colors"
                >
                  <span className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <Link2 size={14} className="shrink-0" />
                    <span className="truncate">{t("invite.joinLink")}</span>
                  </span>
                  <span className="text-[var(--color-accent-glow)] text-xs shrink-0">
                    {copied ? t("invite.copied") : t("invite.copy")}
                  </span>
                </button>
              )}

              <div className="flex gap-2">
                <button
                  onClick={generate}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <RefreshCw size={14} />
                  {t("invite.newCode")}
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-glow)] hover:opacity-90 transition-opacity"
                >
                  {t("invite.done")}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p>
          )}

          <p className="mt-4 text-[11px] text-[var(--color-text-muted)] text-center leading-relaxed">
            {t("invite.note")}
          </p>
        </div>
      </div>
    </div>
  );
}

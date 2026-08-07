"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { UserCircle, Check, Loader2, KeyRound, ShieldCheck } from "lucide-react";

/**
 * Account panel — lets ANY logged-in user set or change their own
 * username + password so they can log back in after their session expires.
 * Calls GET/POST /api/auth/password.
 */
export default function AccountPanel() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/password");
        const data = await res.json();
        setHasAccount(data.hasAccount || false);
        if (data.username) setUsername(data.username);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!/^[a-zA-Z0-9_-]{3,24}$/.test(username)) {
      setError(t("account.error.username"));
      return;
    }
    if (password.length < 6) {
      setError(t("account.error.password"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setHasAccount(true);
        setPassword("");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError(t("account.error.network"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <UserCircle size={16} className="text-[var(--color-accent)]" />
        <h3 className="font-semibold text-sm">{t("account.title")}</h3>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        {t("account.desc")}
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Loader2 size={12} className="animate-spin" />
          {t("account.loading")}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {hasAccount && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-teal)]">
              <ShieldCheck size={12} />
              {t("account.active")}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
              {t("account.username")}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))
              }
              placeholder={t("account.username.ph")}
              maxLength={24}
              autoComplete="username"
              className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
              {t("account.password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {error && (
            <div className="p-2 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-xs text-[var(--color-danger)]">
              {error}
            </div>
          )}
          {success && (
            <div className="p-2 rounded-lg bg-[var(--color-teal)]/10 border border-[var(--color-teal)]/20 text-xs text-[var(--color-teal)]">
              {t("account.saved")}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-glow)] transition-colors"
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : hasAccount ? (
              <Check size={12} />
            ) : (
              <KeyRound size={12} />
            )}
            {saving
              ? t("account.saving")
              : hasAccount
                ? t("account.update")
                : t("account.setup")}
          </button>
        </form>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { LifeBuoy, Check, Loader2, ShieldAlert } from "lucide-react";

/**
 * RecoveryPanel — admin-only emergency escape hatch.
 *
 * Lets an admin reset ANY user's account credentials using the INIT_KEY,
 * even if that user (or the admin) is locked out of their session. This
 * calls POST /api/admin/recover which is gated by the INIT_KEY env var.
 *
 * This is deliberately separate from the normal MembersManager flow
 * (/api/admin/users) because that requires an active admin session; this
 * recovery path works with the root-level INIT_KEY instead.
 */
export default function RecoveryPanel() {
  const { t } = useI18n();
  const [initKey, setInitKey] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [nickname, setNickname] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Pre-fill the current tenant slug from the URL path: /<tenantSlug>/settings
  useEffect(() => {
    if (tenantSlug) return;
    try {
      const seg = window.location.pathname.split("/").filter(Boolean);
      if (seg[0]) setTenantSlug(seg[0].toLowerCase().replace(/[^a-z0-9-]/g, ""));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!initKey.trim()) {
      setError(t("recover.error.initKey"));
      return;
    }
    if (!tenantSlug.trim()) {
      setError(t("recover.error.tenant"));
      return;
    }
    if (!nickname.trim()) {
      setError(t("recover.error.nickname"));
      return;
    }
    if (!/^[a-zA-Z0-9_-]{3,24}$/.test(newUsername)) {
      setError(t("recover.error.username"));
      return;
    }
    if (newPassword.length < 6) {
      setError(t("recover.error.password"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: initKey,
          tenantSlug: tenantSlug.trim().toLowerCase(),
          nickname: nickname.trim(),
          newUsername,
          newPassword,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess(
          t("recover.success", {
            nickname: data.nickname,
            username: data.username,
            tenantSlug: data.tenantSlug,
          })
        );
        setNewPassword("");
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
        <LifeBuoy size={16} className="text-[var(--color-danger)]" />
        <h3 className="font-semibold text-sm">{t("recover.title")}</h3>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
        <ShieldAlert size={14} className="text-[var(--color-danger)] shrink-0 mt-0.5" />
        <span>{t("recover.warn")}</span>
      </div>

      <form onSubmit={handleRecover} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
              {t("recover.tenant.label")}
            </label>
            <input
              type="text"
              value={tenantSlug}
              onChange={(e) =>
                setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              placeholder={t("recover.tenant.ph")}
              className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
              {t("recover.nickname.label")}
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t("recover.nickname.ph")}
              className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
              {t("recover.username.label")}
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) =>
                setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))
              }
              maxLength={24}
              placeholder={t("recover.username.ph")}
              className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
              {t("recover.password.label")}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
            {t("recover.initKey.label")}
          </label>
          <input
            type="password"
            value={initKey}
            onChange={(e) => setInitKey(e.target.value)}
            placeholder={t("recover.initKey.ph")}
            autoComplete="off"
            className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-accent)]"
          />
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
            {t("recover.initKey.hint")}
          </p>
        </div>

        {error && (
          <div className="p-2 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-xs text-[var(--color-danger)]">
            {error}
          </div>
        )}
        {success && (
          <div className="p-2 rounded-lg bg-[var(--color-teal)]/10 border border-[var(--color-teal)]/20 text-xs text-[var(--color-teal)] break-all">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-danger)] text-white text-xs font-medium hover:opacity-90 transition-colors"
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Check size={12} />
          )}
          {t("recover.submit")}
        </button>
      </form>
    </div>
  );
}
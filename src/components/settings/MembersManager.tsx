"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Users,
  Check,
  Loader2,
  Trash2,
  ShieldCheck,
  KeyRound,
  X,
  HeartCrack,
} from "lucide-react";

interface Member {
  id: string;
  nickname: string;
  role: string;
  username: string | null;
  hasAccount: boolean;
  isOnline: boolean | null;
  adultEnabled?: boolean | null;
}

/**
 * Members manager — admin only. Lists all members and lets the admin
 * set or clear a member's username + password (account-based login).
 * Calls GET/POST /api/admin/users.
 */
export default function MembersManager() {
  const { t } = useI18n();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState("");

  const runCleanup = async () => {
    if (!window.confirm(t("admin.users.cleanupConfirm"))) return;
    setCleaning(true);
    setCleanResult("");
    try {
      const res = await fetch("/api/admin/cleanup", { method: "POST" });
      const data = await res.json();
      if (data.count != null) {
        setCleanResult(data.count > 0 ? t("admin.users.cleanupDone", { count: data.count }) : t("admin.users.cleanupNone"));
        await loadMembers();
      } else {
        setError(data.error || "cleanup failed");
      }
    } catch {
      setError(t("billing.error.network"));
    } finally {
      setCleaning(false);
    }
  };

  const toggleAdult = async (m: Member, value: boolean) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: m.id, adultEnabled: value }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      await loadMembers();
    } catch {
      setError(t("billing.error.network"));
    }
  };

  const loadMembers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setMembers([]);
      } else {
        setMembers(data.users || []);
      }
    } catch {
      setError(t("account.error.network"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (m: Member) => {
    setEditing(m);
    setUsername(m.username || "");
    setPassword("");
    setError("");
  };

  const closeEdit = () => {
    setEditing(null);
    setUsername("");
    setPassword("");
    setError("");
  };

  const handleSetCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError("");

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
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editing.id, username, password }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        closeEdit();
        await loadMembers();
      }
    } catch {
      setError(t("account.error.network"));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (m: Member) => {
    if (!window.confirm(t("admin.users.clearConfirm", { name: m.nickname }))) return;
    try {
      await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: m.id, clear: true }),
      });
      await loadMembers();
    } catch {
      setError(t("account.error.network"));
    }
  };

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[var(--color-teal)]" />
          <h3 className="font-semibold text-sm">{t("admin.users.title")}</h3>
        </div>
        <div className="flex items-center gap-2">
          {cleanResult && (
            <span className="text-[10px] text-[var(--color-teal)]">{cleanResult}</span>
          )}
          <button
            onClick={runCleanup}
            disabled={cleaning}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-danger)] disabled:opacity-40 transition-colors"
            title={t("admin.users.cleanupHint")}
          >
            {cleaning ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            {t("admin.users.cleanup")}
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        {t("admin.users.desc")}
      </p>

      {error && (
        <div className="p-2 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-xs text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Loader2 size={12} className="animate-spin" />
          {t("account.loading")}
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/40"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{m.nickname}</span>
                  {m.role === "admin" && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-accent-glow)] uppercase">
                      {t("admin.users.admin")}
                    </span>
                  )}
                  {m.isOnline && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-teal)]" />
                  )}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-2">
                  {m.hasAccount ? (
                    <span className="flex items-center gap-1 text-[var(--color-teal)]">
                      <KeyRound size={10} />
                      @{m.username}
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">
                      {t("admin.users.noAccount")}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* 18+ zone grant — admin can enable/disable per member */}
                <button
                  onClick={() => toggleAdult(m, !m.adultEnabled)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors ${
                    m.adultEnabled
                      ? "bg-[var(--color-danger)]/15 text-[var(--color-danger)]"
                      : "bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  }`}
                  title={t("admin.users.adultHint")}
                >
                  <HeartCrack size={10} />
                  18+
                </button>
                {m.hasAccount ? (
                  <button
                    onClick={() => openEdit(m)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    <ShieldCheck size={10} />
                    {t("admin.users.edit")}
                  </button>
                ) : (
                  <button
                    onClick={() => openEdit(m)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-[var(--color-accent-muted)] text-[var(--color-accent-glow)] hover:bg-[var(--color-accent)]/20 transition-colors"
                  >
                    <KeyRound size={10} />
                    {t("admin.users.set")}
                  </button>
                )}
                {m.hasAccount && (
                  <button
                    onClick={() => handleClear(m)}
                    className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)] transition-colors"
                    title={t("admin.users.clear")}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit credential modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleSetCredentials}
            className="glass-card p-5 w-full max-w-sm animate-slide-up space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">{t("admin.users.setTitle")}</h4>
              <button
                type="button"
                onClick={closeEdit}
                className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {t("admin.users.setDesc", { name: editing.nickname })}
            </p>

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
                maxLength={24}
                autoComplete="off"
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

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-glow)] transition-colors"
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Check size={12} />
                )}
                {t("account.save")}
              </button>
              <button
                type="button"
                onClick={closeEdit}
                className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {t("account.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

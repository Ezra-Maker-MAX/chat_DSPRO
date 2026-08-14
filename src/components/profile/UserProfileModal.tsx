"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { X, Loader2, Plus, Trash2, Check, RefreshCcw, UserRound } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import type { UserProfile, ProfileField } from "@/app/api/profile/route";

const EMPTY: UserProfile = { avatarUrl: null, fields: [] };

/**
 * Editable user profile modal.
 * mode="sfw"  → shown in the normal space (standard theme)
 * mode="nsfw" → shown inside the 18+ zone (auto re-skinned to Scarlet Night
 *               via the .adult-theme scope)
 * Users can freely add / remove / edit key-value fields and set a custom
 * avatar URL (or reset to the generated seed avatar).
 */
export default function UserProfileModal({
  mode,
  open,
  onClose,
  onSaved,
}: {
  mode: "sfw" | "nsfw";
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [seed, setSeed] = useState("usr_");
  const [nickname, setNickname] = useState("");
  const [profile, setProfile] = useState<UserProfile>(EMPTY);
  const [avatarInput, setAvatarInput] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setSaved(false);
    fetch(`/api/profile?kind=${mode}`)
      .then((r) => r.json())
      .then((data) => {
        setSeed(data.user?.avatarSeed || "usr_");
        setNickname(data.user?.nickname || "");
        setProfile(data.user?.profile || EMPTY);
        setAvatarInput(data.user?.profile?.avatarUrl || "");
        setLoading(false);
      })
      .catch(() => {
        setError(t("billing.error.network"));
        setLoading(false);
      });
  }, [open, mode, t]);

  const setField = (i: number, patch: Partial<ProfileField>) => {
    setProfile((p) => {
      const fields = p.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
      return { ...p, fields };
    });
  };
  const removeField = (i: number) => {
    setProfile((p) => ({ ...p, fields: p.fields.filter((_, idx) => idx !== i) }));
  };
  const addField = () => {
    setProfile((p) => ({ ...p, fields: [...p.fields, { k: "", v: "" }] }));
  };

  const applyAvatar = () => {
    setProfile((p) => ({ ...p, avatarUrl: avatarInput.trim() || null }));
  };
  const resetAvatar = () => {
    setAvatarInput("");
    setProfile((p) => ({ ...p, avatarUrl: null }));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: mode,
          avatarUrl: profile.avatarUrl,
          fields: profile.fields,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("billing.error.network"));
      } else {
        setSaved(true);
        onSaved?.();
        setTimeout(() => setSaved(false), 1600);
      }
    } catch {
      setError(t("billing.error.network"));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-md max-h-[86vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[0_24px_70px_rgba(0,0,0,0.55)] ${
          mode === "nsfw" ? "adult-theme" : ""
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center gap-2.5 px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-card)]/95 backdrop-blur z-10">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent-muted)]">
            <UserRound size={16} className="text-[var(--color-accent)]" />
          </div>
          <h2 className="flex-1 font-[family-name:var(--font-display)] text-sm font-bold text-[var(--color-text-primary)]">
            {mode === "nsfw" ? t("profile.title.nsfw") : t("profile.title.sfw")}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {error && (
              <div className="rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
                {error}
              </div>
            )}

            {/* Avatar */}
            <div>
              <label className="mb-2 block text-xs font-medium text-[var(--color-text-muted)]">
                {t("profile.avatar")}
              </label>
              <div className="flex items-center gap-3">
                <UserAvatar seed={seed} nickname={nickname} url={profile.avatarUrl} size={64} />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={avatarInput}
                      onChange={(e) => setAvatarInput(e.target.value)}
                      placeholder={t("profile.avatarUrl")}
                      className="flex-1 min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] outline-none transition-colors"
                    />
                    <button
                      onClick={applyAvatar}
                      className="shrink-0 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-glow)] transition-colors"
                    >
                      {t("profile.avatarApply")}
                    </button>
                  </div>
                  <button
                    onClick={resetAvatar}
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                  >
                    <RefreshCcw size={11} /> {t("profile.avatarReset")}
                  </button>
                </div>
              </div>
            </div>

            {/* Custom fields */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs font-medium text-[var(--color-text-muted)]">
                  {t("profile.fields")}
                </label>
                <button
                  onClick={addField}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <Plus size={12} /> {t("profile.addField")}
                </button>
              </div>

              {profile.fields.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-5 text-center text-[11px] text-[var(--color-text-muted)]">
                  {t("profile.noFields")}
                </div>
              ) : (
                <div className="space-y-2">
                  {profile.fields.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={f.k}
                        onChange={(e) => setField(i, { k: e.target.value })}
                        placeholder={t("profile.fieldKey")}
                        className="w-1/3 shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] outline-none transition-colors"
                      />
                      <input
                        value={f.v}
                        onChange={(e) => setField(i, { v: e.target.value })}
                        placeholder={t("profile.fieldValue")}
                        className="flex-1 min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] outline-none transition-colors"
                      />
                      <button
                        onClick={() => removeField(i)}
                        className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition-colors"
                        title={t("profile.delete")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-glow)] disabled:opacity-60 transition-all"
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : saved ? (
                  <Check size={15} />
                ) : null}
                {saving ? t("profile.saving") : saved ? t("profile.saved") : t("profile.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

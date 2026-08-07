"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Bot, Save, Loader2, Check, Image } from "lucide-react";

interface BotProfile {
  id: string;
  name: string;
  systemPrompt: string;
  isEnabled: boolean;
  imageProvider: string | null;
  imageModel: string | null;
  imageBaseUrl: string | null;
  imageCooldownMs: number;
  imageConfigured: boolean;
  lastImageAt: string | null;
}

export default function BotSettings() {
  const { t } = useI18n();
  const [profile, setProfile] = useState<BotProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [imageProvider, setImageProvider] = useState("openai");
  const [imageModel, setImageModel] = useState("gpt-image-1");
  const [imageApiKey, setImageApiKey] = useState("");
  const [imageBaseUrl, setImageBaseUrl] = useState("");
  const [imageCooldownMs, setImageCooldownMs] = useState(180000);

  useEffect(() => {
    fetch("/api/bot/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) {
          const p = data.profile;
          setProfile(p);
          setName(p.name);
          setSystemPrompt(p.systemPrompt || "");
          setIsEnabled(p.isEnabled);
          setImageProvider(p.imageProvider || "openai");
          setImageModel(p.imageModel || "gpt-image-1");
          setImageBaseUrl(p.imageBaseUrl || "");
          setImageCooldownMs(p.imageCooldownMs ?? 180000);
        }
      })
      .catch(() => setError(t("bot.error.load")))
      .finally(() => setLoading(false));
  }, [t]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const body: Record<string, unknown> = {
        name,
        systemPrompt,
        isEnabled,
        imageProvider,
        imageModel,
        imageBaseUrl,
        imageCooldownMs,
      };
      if (imageApiKey.trim()) body.imageApiKey = imageApiKey.trim();

      const res = await fetch("/api/bot/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("bot.error.network"));
        return;
      }
      setProfile(data.profile);
      setImageApiKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(t("bot.error.network"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={18} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-xs text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* Identity */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-[var(--color-teal)]" />
          <h3 className="font-semibold text-sm">{t("bot.identity")}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
              {t("bot.name")}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="accent-[var(--color-teal)]"
              />
              {t("bot.enabled")}
            </label>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
            {t("bot.systemPrompt")}
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={3}
            className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-[var(--color-accent)]"
            placeholder={t("bot.systemPrompt.ph")}
          />
        </div>
      </div>

      {/* Image gateway */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image size={16} className="text-[var(--color-accent-glow)]" />
            <h3 className="font-semibold text-sm">{t("bot.imageGateway")}</h3>
          </div>
          {profile?.imageConfigured && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-teal-muted)] text-[var(--color-teal)]">
              {t("bot.configured")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
              {t("bot.provider")}
            </label>
            <select
              value={imageProvider}
              onChange={(e) => setImageProvider(e.target.value)}
              className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="openai">OpenAI (images API)</option>
              <option value="custom">Custom endpoint</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
              {t("bot.model")}
            </label>
            <input
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              placeholder="gpt-image-1 / dall-e-3"
              className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
            {t("bot.apiKey", { suffix: profile?.imageConfigured ? t("bot.apiKey.keep") : "" })}
          </label>
          <input
            type="password"
            value={imageApiKey}
            onChange={(e) => setImageApiKey(e.target.value)}
            placeholder={profile?.imageConfigured ? "•••••••• (configured)" : t("bot.apiKey.ph")}
            className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
              {t("bot.baseUrl")}
            </label>
            <input
              value={imageBaseUrl}
              onChange={(e) => setImageBaseUrl(e.target.value)}
              placeholder={t("bot.baseUrl.ph")}
              className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
              {t("bot.cooldown")}
            </label>
            <input
              type="number"
              min={0}
              max={3600}
              value={Math.round(imageCooldownMs / 1000)}
              onChange={(e) => setImageCooldownMs(Number(e.target.value) * 1000)}
              className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>

        <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
          {t("bot.cooldown.hint")}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-glow)] transition-colors"
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin" />
          ) : saved ? (
            <Check size={12} />
          ) : (
            <Save size={12} />
          )}
          {saving ? t("bot.saving") : saved ? t("bot.saved") : t("bot.save")}
        </button>
        {profile?.lastImageAt && (
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {t("bot.lastImage", { time: new Date(profile.lastImageAt).toLocaleTimeString() })}
          </span>
        )}
      </div>
    </div>
  );
}

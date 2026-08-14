"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Tag, Loader2, Save, Check } from "lucide-react";

interface Rule {
  provider: string;
  model: string;
  inputCentsPer1m: number;
  outputCentsPer1m: number;
  imageCentsPerUnit: number;
}

/**
 * 定价管理（管理员）：编辑各 provider/model 的售价（¥/百万token 输入/输出、¥/张图）。
 * 未配置的模型回退到 defaults。
 */
export default function PricingPanel() {
  const { t } = useI18n();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const fetchRules = async () => {
    try {
      const res = await fetch("/api/billing/pricing");
      const data = await res.json();
      setRules(Array.isArray(data.rules) ? data.rules : []);
    } catch {
      setError(t("billing.error.network"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const updateRule = (idx: number, patch: Partial<Rule>) => {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const saveAll = async () => {
    setSaving(true);
    setError("");
    try {
      for (const r of rules) {
        await fetch("/api/billing/pricing", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(r),
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(t("billing.error.network"));
    } finally {
      setSaving(false);
    }
  };

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      { provider: "deepseek", model: "", inputCentsPer1m: 300, outputCentsPer1m: 1300, imageCentsPerUnit: 0 },
    ]);
  };

  const removeRule = (idx: number) => {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  };

  const label = (provider: string) =>
    ({ deepseek: "DeepSeek", openai: "OpenAI", anthropic: "Claude", google: "Gemini", custom: "Custom" })[provider] || provider;

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-[var(--color-accent-glow)]" />
          <h3 className="font-semibold text-sm">{t("pricing.title")}</h3>
        </div>
        <button
          onClick={addRule}
          className="text-xs text-[var(--color-accent-glow)] hover:underline"
        >
          + {t("pricing.add")}
        </button>
      </div>
      <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
        {t("pricing.hint")}
      </p>

      {error && (
        <div className="p-2.5 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-xs text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={16} className="animate-spin text-[var(--color-text-muted)]" />
        </div>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[110px_1fr_80px_80px_80px_32px] gap-2 px-1 text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">
            <span>{t("pricing.provider")}</span>
            <span>{t("pricing.model")}</span>
            <span>{t("pricing.input")}</span>
            <span>{t("pricing.output")}</span>
            <span>{t("pricing.image")}</span>
            <span />
          </div>

          {rules.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)] py-2">{t("pricing.empty")}</p>
          )}

          {rules.map((r, idx) => (
            <div key={idx} className="grid grid-cols-[110px_1fr_80px_80px_80px_32px] gap-2 items-center">
              <select
                value={r.provider}
                onChange={(e) => updateRule(idx, { provider: e.target.value })}
                className="bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[var(--color-accent)]"
              >
                {["deepseek", "openai", "anthropic", "google", "custom"].map((p) => (
                  <option key={p} value={p}>{label(p)}</option>
                ))}
              </select>
              <input
                value={r.model}
                onChange={(e) => updateRule(idx, { model: e.target.value })}
                placeholder={t("pricing.default")}
                className="bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
              />
              <input
                type="number"
                value={r.inputCentsPer1m}
                onChange={(e) => updateRule(idx, { inputCentsPer1m: Number(e.target.value) })}
                className="bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:border-[var(--color-accent)]"
                title="¥ per 1M input tokens (cents)"
              />
              <input
                type="number"
                value={r.outputCentsPer1m}
                onChange={(e) => updateRule(idx, { outputCentsPer1m: Number(e.target.value) })}
                className="bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:border-[var(--color-accent)]"
                title="¥ per 1M output tokens (cents)"
              />
              <input
                type="number"
                value={r.imageCentsPerUnit}
                onChange={(e) => updateRule(idx, { imageCentsPerUnit: Number(e.target.value) })}
                className="bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:border-[var(--color-accent)]"
                title="¥ per image"
              />
              <button
                onClick={() => removeRule(idx)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] text-sm"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}

          <button
            onClick={saveAll}
            disabled={saving}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-glow)] disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : <Save size={12} />}
            {saving ? t("bot.saving") : saved ? t("bot.saved") : t("bot.save")}
          </button>
        </div>
      )}
    </div>
  );
}

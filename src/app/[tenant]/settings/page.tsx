"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Settings, Cpu, Plus, Trash2, Loader2, Check, X, Key, Globe, Bot, BookOpen } from "lucide-react";
import BotSettings from "@/components/settings/BotSettings";
import WorldBooksManager from "@/components/settings/WorldBooksManager";

interface LLM{t("settings.form.provider")} {
  id: string;
  name: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  isActive: boolean;
}

export default function SettingsPage() {
  const { t } = useI18n();
  const [providers, set{t("settings.form.provider")}s] = useState<LLM{t("settings.form.provider")}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [form{t("settings.form.provider")}, setForm{t("settings.form.provider")}] = useState("openai");
  const [formModel, setFormModel] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const fetch{t("settings.form.provider")}s = async () => {
    const res = await fetch("/api/llm/providers");
    const data = await res.json();
    set{t("settings.form.provider")}s(data.providers || []);
    setLoading(false);
  };

  useEffect(() => {
    fetch{t("settings.form.provider")}s();
  }, []);

  const handleAdd = async () => {
    setError("");
    if (!formName || !formModel || !formApiKey) {
      setError(t("settings.error.required"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/llm/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          provider: form{t("settings.form.provider")},
          model: formModel,
          apiKey: formApiKey,
          baseUrl: formBaseUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setShowAdd(false);
        resetForm();
        await fetch{t("settings.form.provider")}s();
      }
    } catch {
      setError(t("settings.error.add"));
    }    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/llm/providers?id=${id}`, { method: "DELETE" });
    await fetch{t("settings.form.provider")}s();
  };

  const resetForm = () => {
    setFormName("");
    setForm{t("settings.form.provider")}("openai");
    setFormModel("");
    setFormApiKey("");
    setFormBaseUrl("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  const providerIcons: Record<string, string> = {
    openai: "🤖",
    anthropic: "🧠",
    deepseek: "🔍",
    google: "🌐",
  };

  return (
    <div className="h-dvh overflow-y-auto p-4 sm:p-6 pt-16 md:pt-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-muted)] flex items-center justify-center">
              <Settings size={20} className="text-[var(--color-accent-glow)]" />
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-bold text-2xl">
              {t("settings.title")}
            </h1>
          </div>
        </div>

        {/* {t("settings.llm")} */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-[var(--color-accent)]" />
              <h2 className="font-semibold text-sm">{t("settings.llm")}</h2>
            </div>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent-muted)] text-[var(--color-accent-glow)] text-xs font-medium hover:bg-[var(--color-accent)]/20 transition-colors"
            >
              <Plus size={12} />
              {t("settings.add{t("settings.form.provider")}")}
            </button>
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="glass-card p-4 mb-4 animate-slide-up space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
                    {t("settings.form.name")}
                  </label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="{t("settings.form.name.ph")}"
                    className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
                    {t("settings.form.provider")}
                  </label>
                  <select
                    value={form{t("settings.form.provider")}}
                    onChange={(e) => setForm{t("settings.form.provider")}(e.target.value)}
                    className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="google">Google AI</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
                  {t("settings.form.model")}
                </label>
                <input
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  placeholder="{t("settings.form.model.ph")}"
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
                  {t("settings.form.apiKey")}
                </label>
                <input
                  type="password"
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
                  {t("settings.form.baseUrl")}
                </label>
                <input
                  value={formBaseUrl}
                  onChange={(e) => setFormBaseUrl(e.target.value)}
                  placeholder="{t("settings.form.baseUrl.ph")}"
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              {error && (
                <div className="p-2 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-xs text-[var(--color-danger)]">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-glow)] transition-colors"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  {t("settings.save")}
                </button>
                <button
                  onClick={() => { setShowAdd(false); resetForm(); }}
                  className="px-4 py-2 rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {t("settings.cancel")}
                </button>
              </div>
            </div>
          )}

          {/* {t("settings.form.provider")} list */}
          {providers.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Key size={24} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("settings.empty.title")}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {t("settings.empty.hint")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="glass-card p-4 flex items-center gap-3 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-elevated)] flex items-center justify-center text-lg">
                    {providerIcons[p.provider] || "🔌"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] uppercase">
                        {p.provider}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mt-1">
                      <span className="font-mono">{p.model}</span>
                      {p.baseUrl && (
                        <span className="flex items-center gap-1">
                          <Globe size={10} />
                          {p.baseUrl}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-teal)]" />
                    )}
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)] opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* How to use section */}
        <section className="mt-8 p-4 glass-card">
          <h3 className="font-semibold text-sm mb-2">{t("settings.routing.title")}</h3>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {t("settings.routing.desc")}
          </p>
        </section>

        {/* {t("settings.bot")} */}
        <section className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={16} className="text-[var(--color-teal)]" />
            <h2 className="font-semibold text-sm">{t("settings.bot")}</h2>
          </div>
          <BotSettings />
        </section>

        {/* World Books */}
        <section className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={16} className="text-[var(--color-accent-glow)]" />
            <h2 className="font-semibold text-sm">{t("wb.title")}</h2>
          </div>
          <WorldBooksManager />
        </section>
      </div>
    </div>
  );
}

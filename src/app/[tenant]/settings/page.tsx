"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Settings, Cpu, Plus, Trash2, Loader2, Check, Key, Globe, Bot, BookOpen, UserCircle, Users, LifeBuoy, Route, ArrowDownUp } from "lucide-react";
import BotSettings from "@/components/settings/BotSettings";
import WorldBooksManager from "@/components/settings/WorldBooksManager";
import AccountPanel from "@/components/settings/AccountPanel";
import MembersManager from "@/components/settings/MembersManager";
import RecoveryPanel from "@/components/settings/RecoveryPanel";
import GatewayPanel from "@/components/settings/GatewayPanel";
import { useLayout } from "@/components/layout/LayoutContext";

interface LLM {
  id: string;
  name: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  isActive: boolean;
}

interface LLMRoute {
  id: string;
  name: string;
  providerId: string;
  condition: string;
  priority: number;
  isActive: boolean;
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { userRole } = useLayout();
  const isAdmin = userRole === "admin";
  const [providers, setProviders] = useState<LLM[]>([]);
  const [routes, setRoutes] = useState<LLMRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");

  // Routes state
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [routeProviderId, setRouteProviderId] = useState("");
  const [routeCondition, setRouteCondition] = useState("*");
  const [routePriority, setRoutePriority] = useState(0);
  const [routeError, setRouteError] = useState("");
  const [routeSaving, setRouteSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formProvider, setFormProvider] = useState("openai");
  const [formModel, setFormModel] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchProviders = async () => {
    const res = await fetch("/api/llm/providers");
    const data = await res.json();
    setProviders(data.providers || []);
    setLoading(false);
  };

  const fetchRoutes = async () => {
    const res = await fetch("/api/llm/routes");
    const data = await res.json();
    setRoutes(data.routes || []);
  };

  useEffect(() => {
    // Only admins can read/manage space-wide LLM providers
    if (isAdmin) {
      fetchProviders();
      fetchRoutes();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

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
          provider: formProvider,
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
        await fetchProviders();
      }
    } catch {
      setError(t("settings.error.add"));
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/llm/providers?id=${id}`, { method: "DELETE" });
    await fetchProviders();
    // Refresh routes too — deleting a provider may leave dangling route refs
    await fetchRoutes();
  };

  const handleAddRoute = async () => {
    setRouteError("");
    if (!routeName || !routeProviderId) {
      setRouteError("Name and provider are required");
      return;
    }
    setRouteSaving(true);
    try {
      const res = await fetch("/api/llm/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: routeName,
          providerId: routeProviderId,
          condition: routeCondition || "*",
          priority: routePriority,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setRouteError(data.error);
      } else {
        setShowAddRoute(false);
        setRouteName("");
        setRouteProviderId("");
        setRouteCondition("*");
        setRoutePriority(0);
        await fetchRoutes();
      }
    } catch {
      setRouteError("Failed to add route");
    }
    setRouteSaving(false);
  };

  const handleDeleteRoute = async (id: string) => {
    await fetch(`/api/llm/routes?id=${id}`, { method: "DELETE" });
    await fetchRoutes();
  };

  const resetForm = () => {
    setFormName("");
    setFormProvider("openai");
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

        {/* Account (self credential setup) */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <UserCircle size={16} className="text-[var(--color-accent)]" />
            <h2 className="font-semibold text-sm">{t("account.section")}</h2>
          </div>
          <AccountPanel />
        </section>

        {/* Non-admin notice */}
        {!isAdmin && (
          <div className="glass-card p-4 text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {t("settings.memberNotice")}
          </div>
        )}

        {/* Admin-only: space-wide configuration */}
        {isAdmin && (
        <>
        {/* LLM Providers */}
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
              {t("settings.addProvider")}
            </button>
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="glass-card p-4 mb-4 animate-slide-up space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
                  {t("settings.form.name")}
                </label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t("settings.form.name.ph")}
                  className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <GatewayPanel
                provider={formProvider}
                setProvider={setFormProvider}
                apiKey={formApiKey}
                setApiKey={setFormApiKey}
                baseUrl={formBaseUrl}
                setBaseUrl={setFormBaseUrl}
                model={formModel}
                setModel={setFormModel}
                modelsPath="/api/llm/providers/models"
                testPath="/api/llm/providers/test"
                providers={[
                  { value: "openai", label: "OpenAI" },
                  { value: "anthropic", label: "Anthropic" },
                  { value: "deepseek", label: "DeepSeek" },
                  { value: "google", label: "Google AI" },
                  { value: "custom", label: "Custom endpoint" },
                ]}
              />

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

          {/* Provider list */}
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

        {/* LLM Routing Rules — required for /chat to find a provider */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Route size={16} className="text-[var(--color-accent-glow)]" />
              <h2 className="font-semibold text-sm">{t("settings.routes.title")}</h2>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]">
                {routes.length}
              </span>
            </div>
            {!showAddRoute && providers.length > 0 && (
              <button
                onClick={() => setShowAddRoute(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90"
              >
                <Plus size={12} />
                {t("settings.routes.add")}
              </button>
            )}
          </div>

          <p className="text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">
            {t("settings.routes.desc")}
          </p>

          {showAddRoute && (
            <div className="glass-card p-4 mb-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
                    Name
                  </label>
                  <input
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    placeholder="e.g. Default"
                    className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
                    Provider
                  </label>
                  <select
                    value={routeProviderId}
                    onChange={(e) => setRouteProviderId(e.target.value)}
                    className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="">Select a provider…</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.provider})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
                    Condition (regex on user prompt, or *)
                  </label>
                  <input
                    value={routeCondition}
                    onChange={(e) => setRouteCondition(e.target.value)}
                    placeholder="*"
                    className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
                    Priority (lower = first match)
                  </label>
                  <input
                    type="number"
                    value={routePriority}
                    onChange={(e) => setRoutePriority(parseInt(e.target.value) || 0)}
                    className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              </div>
              {routeError && (
                <div className="text-xs text-[var(--color-danger)]">{routeError}</div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddRoute}
                  disabled={routeSaving}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {routeSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Save
                </button>
                <button
                  onClick={() => setShowAddRoute(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {routes.length === 0 ? (
            <div className="glass-card p-6 text-center border-dashed">
              <ArrowDownUp size={20} className="mx-auto mb-2 text-[var(--color-text-muted)]" />
              <p className="text-xs text-[var(--color-text-muted)]">
                {t("settings.routes.empty")}
              </p>
              {providers.length > 0 && (
                <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
                  Add a route pointing at one of your providers above to activate /chat.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {routes
                .slice()
                .sort((a, b) => a.priority - b.priority)
                .map((r) => {
                  const provider = providers.find((p) => p.id === r.providerId);
                  return (
                    <div
                      key={r.id}
                      className="glass-card p-3 flex items-center gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-elevated)] flex items-center justify-center">
                        <Route size={14} className="text-[var(--color-accent-glow)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs">{r.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] font-mono">
                            {r.condition}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">
                          → {provider ? `${provider.name} (${provider.model})` : "⚠️ provider missing"}
                        </div>
                      </div>
                      <span className="text-[9px] text-[var(--color-text-muted)] font-mono">
                        p={r.priority}
                      </span>
                      <button
                        onClick={() => handleDeleteRoute(r.id)}
                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)] opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* Bot & AI Gateway */}
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
        </>
        )}

        {/* Members manager (admin only) */}
        {isAdmin && (
          <section className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-[var(--color-teal)]" />
              <h2 className="font-semibold text-sm">{t("admin.users.section")}</h2>
            </div>
            <MembersManager />
          </section>
        )}

        {/* Emergency recovery (admin only) */}
        {isAdmin && (
          <section className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <LifeBuoy size={16} className="text-[var(--color-danger)]" />
              <h2 className="font-semibold text-sm">{t("recover.section")}</h2>
            </div>
            <RecoveryPanel />
          </section>
        )}
      </div>
    </div>
  );
}

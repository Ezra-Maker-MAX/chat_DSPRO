"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Loader2, CheckCircle2, XCircle, RefreshCw, Zap, Info } from "lucide-react";

/**
 * A self-contained "refresh models + test connection" control row.
 * Shows a model selector (refreshable) and a test button with inline result.
 *
 * Use:
 *   <GatewayPanel
 *     provider={provider} setProvider={setProvider}
 *     apiKey={apiKey} setApiKey={setApiKey}
 *     baseUrl={baseUrl} setBaseUrl={setBaseUrl}
 *     model={model} setModel={setModel}
 *     modelsPath="/api/llm/providers/models"
 *     testPath="/api/llm/providers/test"
 *     providerEnum={["openai", "anthropic", "deepseek", "google", "custom"]}
 *   />
 */
interface Props {
  provider: string;
  setProvider: (v: string) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  baseUrl: string;
  setBaseUrl: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  modelsPath: string;
  testPath: string;
  providers: { value: string; label: string }[];
}

export default function GatewayPanel({
  provider,
  setProvider,
  apiKey,
  setApiKey,
  baseUrl,
  setBaseUrl,
  model,
  setModel,
  modelsPath,
  testPath,
  providers,
}: Props) {
  const { t } = useI18n();
  const [models, setModels] = useState<string[]>([]);
  const [modelsSource, setModelsSource] = useState<"live" | "fallback" | "curated" | null>(null);
  const [modelsWarning, setModelsWarning] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    | null
    | { ok: boolean; latencyMs?: number; sample?: string; error?: string; warning?: string }
  >(null);

  const needsApiKey = (p: string) => p !== "custom";

  const refreshModels = async () => {
    if (needsApiKey(provider) && !apiKey.trim()) {
      setModelsWarning(t("gateway.refresh.needKey"));
      return;
    }
    setLoadingModels(true);
    setModelsWarning("");
    try {
      const r = await fetch(modelsPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, baseUrl }),
      });
      const data = await r.json();
      const list: string[] = Array.isArray(data.models) ? data.models : [];
      setModels(list);
      setModelsSource(data.source ?? null);
      setModelsWarning(data.warning ?? "");
      // Auto-pick the first model if current selection isn't in the list
      if (list.length > 0 && !list.includes(model)) setModel(list[0]);
    } catch (e) {
      setModelsWarning(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoadingModels(false);
    }
  };

  const runTest = async () => {
    if (needsApiKey(provider) && !apiKey.trim()) {
      setTestResult({ ok: false, error: t("gateway.test.needKey") });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch(testPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, apiKey, baseUrl }),
      });
      const data = await r.json();
      setTestResult({
        ok: Boolean(data.ok),
        latencyMs: data.latencyMs,
        sample: data.sample,
        error: data.error,
        warning: data.warning,
      });
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : "Network error" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
            {t("gateway.provider")}
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-accent)]"
          >
            {providers.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
            {t("gateway.model")}
          </label>
          <div className="flex gap-1.5">
            {models.length > 0 ? (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="flex-1 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="model-id"
                className="flex-1 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
              />
            )}
            <button
              type="button"
              onClick={refreshModels}
              disabled={loadingModels}
              title={t("gateway.refresh.title")}
              className="px-2.5 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50 transition-colors"
            >
              {loadingModels ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
            </button>
          </div>
          {modelsSource && (
            <p className="text-[10px] mt-1 text-[var(--color-text-muted)]">
              {t(`gateway.source.${modelsSource}`)}
              {modelsWarning ? ` · ${modelsWarning}` : ""}
            </p>
          )}
          {/* When the live fetch failed AND there's no curated fallback to fill
              the dropdown, show an explicit hint — most Custom endpoints don't
              expose /models so hand-keying the ID is the expected workflow. */}
          {modelsSource === "fallback" && models.length === 0 && (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-2 py-1.5 text-[10px] leading-relaxed text-[var(--color-text-secondary)]">
              <Info size={11} className="shrink-0 mt-0.5 text-[var(--color-warning)]" />
              <span>{t("gateway.refresh.noFallback")}</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
          {t("gateway.apiKey")}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t("gateway.apiKey.ph")}
          className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      <div>
        <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1">
          {t("gateway.baseUrl")}
        </label>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={t("gateway.baseUrl.ph")}
          className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={runTest}
          disabled={testing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-teal)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {testing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Zap size={12} />
          )}
          {testing ? t("gateway.testing") : t("gateway.test")}
        </button>
        {testResult && (
          <div
            className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md ${
              testResult.ok
                ? "bg-[var(--color-teal)]/10 text-[var(--color-teal)]"
                : "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
            }`}
          >
            {testResult.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            <span>
              {testResult.ok
                ? t("gateway.test.ok", {
                    ms: testResult.latencyMs ?? 0,
                    sample: testResult.sample ?? "",
                  })
                : testResult.error}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
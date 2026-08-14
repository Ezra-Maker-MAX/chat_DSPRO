"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Bug, RefreshCcw, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface ErrorRow {
  id: string;
  type: string;
  message: string | null;
  stack: string | null;
  url: string | null;
  createdAt: string | null;
}

/** Admin panel — recent frontend error telemetry for this space. */
export default function ErrorLogPanel() {
  const { t } = useI18n();
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/errors?limit=50");
      const data = await res.json();
      setErrors(Array.isArray(data.errors) ? data.errors : []);
    } catch {
      setErrors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const clearAll = async () => {
    if (!window.confirm(t("admin.errors.clearConfirm"))) return;
    setClearing(true);
    try {
      await fetch("/api/admin/errors", { method: "DELETE" });
      setErrors([]);
    } catch {
      /* ignore */
    } finally {
      setClearing(false);
    }
  };

  const typeColor = (type: string) =>
    type === "error"
      ? "bg-[var(--color-danger)]/15 text-[var(--color-danger)]"
      : type === "unhandledrejection"
        ? "bg-[var(--color-warning)]/15 text-[var(--color-warning)]"
        : "bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]";

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug size={16} className="text-[var(--color-warning)]" />
          <h3 className="font-semibold text-sm">{t("admin.errors.title")}</h3>
          {!loading && errors.length > 0 && (
            <span className="rounded-full bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
              {errors.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
            title={t("admin.errors.refresh")}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={clearAll}
            disabled={clearing || errors.length === 0}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] disabled:opacity-30 transition-colors"
            title={t("admin.errors.clear")}
          >
            {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-[var(--color-text-muted)]" />
        </div>
      ) : errors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-[11px] text-[var(--color-text-muted)]">
          {t("admin.errors.empty")}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {errors.map((e) => (
            <div key={e.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)]">
              <button
                onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${typeColor(e.type)}`}>
                  {e.type}
                </span>
                <span className="flex-1 min-w-0 truncate text-xs text-[var(--color-text-secondary)]">
                  {e.message || "—"}
                </span>
                <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]">
                  {e.createdAt ? e.createdAt.replace("T", " ").slice(5, 19) : ""}
                </span>
                {e.stack && (
                  <span className="shrink-0 text-[var(--color-text-muted)]">
                    {expanded === e.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </span>
                )}
              </button>
              {expanded === e.id && e.stack && (
                <pre className="mx-3 mb-2 max-h-36 overflow-auto rounded-lg bg-[var(--color-bg-deep)] px-2.5 py-2 text-[10px] leading-relaxed text-[var(--color-text-muted)] whitespace-pre-wrap">
                  {e.stack}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

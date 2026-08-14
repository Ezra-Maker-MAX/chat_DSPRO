"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";

const STORAGE_KEY = "chatmosphere_adult_ok_v1";

export function hasAdultConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** 18+ 确认屏：本地记住选择，拒绝则留在原地。 */
export default function AdultGate({ onConfirm }: { onConfirm: () => void }) {
  const { t } = useI18n();
  const [denied, setDenied] = useState(false);

  const confirm = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    onConfirm();
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-bg-card)] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        {/* Top bar */}
        <div className="h-1.5 bg-gradient-to-r from-[var(--color-danger)] via-[var(--color-accent)] to-[var(--color-danger)]" />

        <div className="p-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-danger)]/10">
            <AlertTriangle size={30} className="text-[var(--color-danger)]" />
          </div>

          <h1 className="mb-2 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-text-primary)]">
            {t("adult.gate.title")}
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {t("adult.gate.desc")}
          </p>

          <ul className="mb-6 space-y-1.5 text-left text-xs text-[var(--color-text-muted)]">
            {t("adult.gate.rules").split("\n").filter(Boolean).map((rule, i) => (
              <li key={i} className="flex items-start gap-2">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--color-teal)]" />
                {rule}
              </li>
            ))}
          </ul>

          {denied && (
            <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
              {t("adult.gate.denied")}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setDenied(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)]"
            >
              <X size={15} />
              {t("adult.gate.leave")}
            </button>
            <button
              onClick={confirm}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-danger)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90"
            >
              <ShieldCheck size={15} />
              {t("adult.gate.enter")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

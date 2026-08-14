"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { HeartCrack, ShieldX } from "lucide-react";
import RoleplayHub from "@/components/roleplay/RoleplayHub";
import AdultGate, { hasAdultConsent } from "@/components/adult/AdultGate";

/**
 * 成人专区（18+）：入口需管理员授权（adultEnabled）。
 * 未授权 → 显示"无权限"；已授权 → 18+ 确认 → 成人角色卡列表。
 */
export default function AdultPage() {
  const { t } = useI18n();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [confirmed, setConfirmed] = useState<boolean>(() => hasAdultConsent());

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        setGranted(data.user?.adultEnabled === true || data.user?.role === "admin");
      })
      .catch(() => setGranted(false));
  }, []);

  // Loading
  if (granted === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-xs text-[var(--color-text-muted)]">{t("account.loading")}</div>
      </div>
    );
  }

  // Not granted — admin must enable access in Settings → Members
  if (!granted) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-bg-hover)]">
            <ShieldX size={26} className="text-[var(--color-text-muted)]" />
          </div>
          <h1 className="mb-2 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-text-primary)]">
            {t("adult.denied.title")}
          </h1>
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {t("adult.denied.desc")}
          </p>
        </div>
      </div>
    );
  }

  if (!confirmed) {
    return (
      <div className="h-dvh overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto pt-16 md:pt-6">
          <AdultGate onConfirm={() => setConfirmed(true)} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-6 pt-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-danger)]/15">
          <HeartCrack size={16} className="text-[var(--color-danger)]" />
        </div>
        <div className="flex-1">
          <h1 className="font-[family-name:var(--font-display)] text-sm font-bold text-[var(--color-text-primary)]">
            {t("adult.title")}
          </h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {t("adult.subtitle")}
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-hidden mt-3">
        <RoleplayHub adultOnly />
      </div>
    </div>
  );
}

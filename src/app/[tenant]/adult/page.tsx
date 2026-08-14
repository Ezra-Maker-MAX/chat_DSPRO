"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { HeartCrack } from "lucide-react";
import RoleplayHub from "@/components/roleplay/RoleplayHub";
import AdultGate, { hasAdultConsent } from "@/components/adult/AdultGate";

/**
 * 成人专区（18+）：独立入口 + 年龄确认 + 只展示标记为 adult 的角色卡。
 */
export default function AdultPage() {
  const { t } = useI18n();
  const [confirmed, setConfirmed] = useState<boolean>(() => hasAdultConsent());

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

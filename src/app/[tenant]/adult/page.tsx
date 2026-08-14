"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { HeartCrack, ShieldX, Flame } from "lucide-react";
import RoleplayHub from "@/components/roleplay/RoleplayHub";
import AdultGate, { hasAdultConsent } from "@/components/adult/AdultGate";

/**
 * 成人专区（18+）：入口需管理员授权（adultEnabled）。
 * 未授权 → 显示"无权限"；已授权 → 18+ 确认 → 成人专区。
 *
 * 进入后整页切换为 "Scarlet Night" 主题（.adult-theme 作用域覆盖
 * 全部 CSS 变量，所有组件自动转红粉霓虹风格），布局参考海外成人
 * 平台：品牌 Hero 头 + 分类导航固定，卡片网格滚动，底部免责条。
 */
export default function AdultPage() {
  const { t } = useI18n();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [confirmed, setConfirmed] = useState<boolean>(() => hasAdultConsent());
  const [cardCount, setCardCount] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "name" | undefined>(undefined);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        setGranted(data.user?.adultEnabled === true || data.user?.role === "admin");
      })
      .catch(() => setGranted(false));
  }, []);

  // Real stat for the hero band: count of adult cards.
  useEffect(() => {
    if (granted !== true) return;
    fetch("/api/characters?adult=1")
      .then((r) => r.json())
      .then((data) => setCardCount(Array.isArray(data.cards) ? data.cards.length : null))
      .catch(() => setCardCount(null));
  }, [granted]);

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
    <div className="adult-theme h-dvh overflow-hidden flex flex-col">
      {/* ---------- ① Hero band: scarlet brand head ---------- */}
      <div className="shrink-0 px-4 sm:px-8 pt-5 pb-4 border-b border-[var(--color-border)]/60">
        <div className="flex items-center gap-3">
          <div className="adult-pulse flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40">
            <HeartCrack size={20} className="text-[var(--color-accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="adult-hero-title font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold uppercase tracking-tight">
                {t("adult.hero.title")}
              </h1>
              <span className="adult-pulse shrink-0 rounded-md bg-[var(--color-danger)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                18+
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {t("adult.hero.subtitle")}
            </p>
          </div>
        </div>

        {/* Hero stats band — real card count + zone facts */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-muted)] px-2.5 py-1 font-medium text-[var(--color-accent-glow)]">
            <Flame size={12} />
            {cardCount != null
              ? t("adult.hero.stats.cards", { count: cardCount })
              : t("adult.hero.stats.loading")}
          </span>
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-[var(--color-text-secondary)]">
            {t("adult.hero.stats.adult")}
          </span>
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-[var(--color-text-secondary)]">
            {t("adult.hero.stats.gated")}
          </span>
        </div>
      </div>

      {/* ---------- ② Category nav: sticky pill bar ---------- */}
      <div className="shrink-0 flex items-center gap-2 px-4 sm:px-8 py-3 border-b border-[var(--color-border)]/40 bg-[var(--color-bg-base)]/70 backdrop-blur">
        <button
          onClick={() => setSortBy(undefined)}
          className={`adult-pill rounded-full px-3.5 py-1.5 text-xs font-medium ${
            !sortBy ? "adult-pill-active" : ""
          }`}
        >
          {t("adult.tabs.all")}
        </button>
        <button
          onClick={() => setSortBy("newest")}
          className={`adult-pill rounded-full px-3.5 py-1.5 text-xs font-medium ${
            sortBy === "newest" ? "adult-pill-active" : ""
          }`}
        >
          {t("adult.tabs.newest")}
        </button>
        <button
          onClick={() => setSortBy("name")}
          className={`adult-pill rounded-full px-3.5 py-1.5 text-xs font-medium ${
            sortBy === "name" ? "adult-pill-active" : ""
          }`}
        >
          {t("adult.tabs.name")}
        </button>
      </div>

      {/* ---------- ③ Gallery: scrolling card grid (re-skins via .adult-theme) ---------- */}
      <div className="flex-1 overflow-hidden">
        <RoleplayHub adultOnly sortBy={sortBy} />
      </div>

      {/* ---------- ④ Footer disclaimer ---------- */}
      <footer className="shrink-0 border-t border-[var(--color-border)]/60 bg-[var(--color-bg-base)]/80 px-4 sm:px-8 py-2.5">
        <p className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">
          {t("adult.footer.note")}
        </p>
      </footer>
    </div>
  );
}

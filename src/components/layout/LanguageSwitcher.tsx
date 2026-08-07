"use client";

import { useState, useRef, useEffect } from "react";
import { Languages, Check } from "lucide-react";
import { useI18n, SUPPORTED_LOCALES } from "@/lib/i18n";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const labelFor = (l: string) => (l === "zh" ? t("lang.zh") : t("lang.en"));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors w-full"
        aria-label={t("lang.label")}
      >
        <Languages size={16} className="shrink-0" />
        <span className="flex-1 text-left truncate">{labelFor(locale)}</span>
        {!compact && <span className="text-[10px] text-[var(--color-text-muted)]">▾</span>}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-40 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden z-50 animate-fade-in">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
            {t("lang.label")}
          </div>
          {SUPPORTED_LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                locale === l
                  ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-glow)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <span className="flex-1 text-left">{labelFor(l)}</span>
              {locale === l && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { X, Wallet, Check, Loader2, QrCode, ExternalLink, Zap } from "lucide-react";

interface RechargeModalProps {
  onClose: () => void;
}

/**
 * 空间额度充值弹窗。
 * 流程：查看余额 → 选面额 → 展示 DeepSeek 官方充值二维码（扫码付款到管理员
 * DeepSeek 账户）→ 点「我已付款」→ 后端核对 /user/balance 差值 → 自动到账。
 */
export default function RechargeModal({ onClose }: RechargeModalProps) {
  const { t } = useI18n();
  const [balanceCents, setBalanceCents] = useState<number>(0);
  const [topUpUrl, setTopUpUrl] = useState<string>("https://platform.deepseek.com/top_up");
  const [amounts, setAmounts] = useState<number[]>([10, 50, 100]);
  const [deepseekConfigured, setDeepseekConfigured] = useState(false);
  const [deepseekBalance, setDeepseekBalance] = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/status");
      const data = await res.json();
      setBalanceCents(data.balanceCents ?? 0);
      if (data.topUpUrl) setTopUpUrl(data.topUpUrl);
      if (Array.isArray(data.amounts) && data.amounts.length > 0) setAmounts(data.amounts);
      setDeepseekConfigured(!!data.deepseekConfigured);
      setDeepseekBalance(
        data.deepseek?.toppedUpBalance != null
          ? Number(data.deepseek.toppedUpBalance).toFixed(2)
          : null
      );
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const effectiveAmount = selected === 0 ? Number(customAmount) || 0 : selected;

  const createOrder = async () => {
    if (effectiveAmount < 1) {
      setError(t("billing.error.amount"));
      return;
    }
    setCreating(true);
    setError("");
    setOrderId(null);
    setDone(false);
    try {
      const res = await fetch("/api/billing/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: effectiveAmount }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setOrderId(data.orderId);
      if (data.deepseekBalance != null) {
        setDeepseekBalance(Number(data.deepseekBalance).toFixed(2));
      }
    } catch {
      setError(t("billing.error.network"));
    } finally {
      setCreating(false);
    }
  };

  const confirm = async () => {
    if (!orderId) return;
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/billing/confirm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data.success) {
        setBalanceCents(data.balanceCents ?? 0);
        setDone(true);
        setOrderId(null);
        await fetchStatus();
      } else if (res.status === 202) {
        setError(t("billing.pending") + "（" + (data.error || "") + "）");
      } else {
        setError(data.error || t("billing.error.confirm"));
      }
    } catch {
      setError(t("billing.error.network"));
    } finally {
      setChecking(false);
    }
  };

  // QR image via free public API — no extra npm dependency.
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(topUpUrl)}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-[fade-in_0.2s_ease] max-h-[90vh] overflow-y-auto">
        <div className="h-1 rounded-t-2xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-teal)]" />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-muted)] flex items-center justify-center text-[var(--color-accent-glow)]">
                <Wallet size={20} />
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-lg text-[var(--color-text-primary)]">
                  {t("billing.title")}
                </h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {t("billing.subtitle")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" />
            </div>
          ) : done ? (
            /* Success state */
            <div className="py-8 text-center space-y-3">
              <div className="mx-auto w-14 h-14 rounded-full bg-[var(--color-teal-muted)] flex items-center justify-center">
                <Check size={26} className="text-[var(--color-teal)]" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{t("billing.done")}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {t("billing.balance")}: <span className="text-[var(--color-accent-glow)] font-mono">¥{((balanceCents ?? 0) / 100).toFixed(2)}</span>
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:bg-[var(--color-accent-glow)] transition-colors"
              >
                {t("billing.close")}
              </button>
            </div>
          ) : (
            <>
              {/* Current balance */}
              <div className="mb-4 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    {t("billing.balance")}
                  </p>
                  <p className="text-lg font-bold font-mono text-[var(--color-accent-glow)]">
                    ¥{((balanceCents ?? 0) / 100).toFixed(2)}
                  </p>
                </div>
                {deepseekBalance != null && (
                  <div className="text-right">
                    <p className="text-[10px] text-[var(--color-text-muted)]">{t("billing.deepseekBalance")}</p>
                    <p className="text-sm font-mono text-[var(--color-teal)]">¥{deepseekBalance}</p>
                  </div>
                )}
              </div>

              {!deepseekConfigured && (
                <div className="mb-4 p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-xs text-[var(--color-danger)]">
                  {t("billing.notConfigured")}
                </div>
              )}

              {/* Amount picker */}
              <p className="text-xs text-[var(--color-text-muted)] mb-2">{t("billing.amount")}</p>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {amounts.map((a) => (
                  <button
                    key={a}
                    onClick={() => setSelected(a)}
                    className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      selected === a
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent-glow)]"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                    }`}
                  >
                    ¥{a}
                  </button>
                ))}
                <button
                  onClick={() => setSelected(0)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    selected === 0
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent-glow)]"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                  }`}
                >
                  {t("billing.custom")}
                </button>
              </div>
              {selected === 0 && (
                <input
                  type="number"
                  min={1}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={t("billing.customPh")}
                  className="mb-3 w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
                />
              )}

              {error && (
                <div className="mb-3 p-2.5 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-xs text-[var(--color-danger)]">
                  {error}
                </div>
              )}

              {/* Step 1: create order → show QR */}
              {!orderId ? (
                <button
                  onClick={createOrder}
                  disabled={creating || effectiveAmount < 1}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-glow)] disabled:opacity-40 transition-colors"
                >
                  {creating ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
                  {t("billing.next")}
                </button>
              ) : (
                /* Step 2: QR + confirm */
                <div className="space-y-3">
                  <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 flex flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrUrl}
                      alt="DeepSeek top-up QR"
                      width={220}
                      height={220}
                      className="rounded-lg"
                    />
                    <p className="text-xs text-[var(--color-text-secondary)] text-center leading-relaxed">
                      {t("billing.scanHint")}
                    </p>
                    <a
                      href={topUpUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-accent-glow)] hover:underline"
                    >
                      <ExternalLink size={12} />
                      {t("billing.openPage")}
                    </a>
                  </div>
                  <button
                    onClick={confirm}
                    disabled={checking}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-teal)] text-[var(--color-bg-deep)] text-sm font-medium hover:bg-[var(--color-accent-glow)] hover:text-white disabled:opacity-40 transition-colors"
                  >
                    {checking ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                    {checking ? t("billing.checking") : t("billing.paid")}
                  </button>
                  <button
                    onClick={() => { setOrderId(null); setError(""); }}
                    className="w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] py-1"
                  >
                    {t("billing.back")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

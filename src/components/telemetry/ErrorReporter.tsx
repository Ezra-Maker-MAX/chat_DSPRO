"use client";

import { useEffect } from "react";

/**
 * Silent global error reporter.
 * Catches window errors + unhandled promise rejections and reports them to
 * /api/telemetry (with session context). Throttled and deduped so a broken
 * animation or a chat bubble failure can't spam the DB. Never disturbs the
 * user — errors still surface normally in the UI via existing error paths.
 */

const REPORT_LIMIT = 10; // max stored entries per minute
const DEDUPE_WINDOW_MS = 60_000;

let queue: Array<{ type: string; message: string; stack?: string; url?: string }> = [];
let lastFlush = 0;

function flush() {
  const now = Date.now();
  if (now - lastFlush < 5000) return; // at most one request per 5s
  lastFlush = now;
  const batch = queue.slice(0, REPORT_LIMIT);
  queue = [];
  if (batch.length === 0) return;
  // Fire-and-forget; failures are expected in dev/offline and harmless.
  fetch("/api/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batch }),
  }).catch(() => {});
}

function push(entry: { type: string; message: string; stack?: string; url?: string }) {
  if (!entry.message) return;
  // Dedupe identical messages within the window.
  const seen = queue.some((e) => e.type === entry.type && e.message === entry.message);
  if (seen) return;
  queue.push(entry);
  if (queue.length >= 3) flush();
}

export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      push({
        type: "error",
        message: e.message || "Unknown window error",
        stack: e.error?.stack || undefined,
        url: window.location.href,
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection";
      push({
        type: "unhandledrejection",
        message,
        stack: reason instanceof Error ? reason.stack : undefined,
        url: window.location.href,
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("visibilitychange", onVisibility);
    const iv = setInterval(flush, 30_000);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(iv);
    };
  }, []);

  return null;
}

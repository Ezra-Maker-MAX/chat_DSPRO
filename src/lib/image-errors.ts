// ============================================================
// Friendly error translation for image-generation gateways.
// OpenAI-style APIs return raw JSON like {"error":{"code":"content_policy_violation"}}
// which is meaningless to end users. This module surfaces a short
// Chinese-friendly message plus a hint, while keeping the raw body in
// the response for power users.
// ============================================================

/** Patterns matched against the raw upstream error message. */
const POLICY_HINTS = [
  { code: "content_policy_violation", needle: /content_policy_violation|content[- ]policy/i },
  { code: "safety", needle: /\bsafety\b|safety_system|rejected.*safety/i },
  { code: "blocked", needle: /\bblocked\b|was blocked/i },
  { code: "moderation", needle: /moderation/i },
  { code: "rate_limit", needle: /rate[- ]limit|too many requests/i },
  { code: "billing", needle: /billing|insufficient[- ]quota|quota/i },
];

export interface HumanizedImageError {
  /** Short Chinese label safe to surface to end users. */
  message: string;
  /** Suggestion for what they can do. */
  hint: string;
  /** Machine-readable code so the UI can render an icon / colour. */
  code: string;
  /** Original upstream text for debugging. */
  raw: string;
}

export function humanizeImageError(raw: string): HumanizedImageError {
  const text = String(raw || "");

  for (const { code, needle } of POLICY_HINTS) {
    if (needle.test(text)) {
      if (code === "content_policy_violation" || code === "safety" || code === "blocked" || code === "moderation") {
        return {
          code,
          message: "提示词被内容审核拒绝",
          hint: "换个更通用、避免敏感词的描述再试（例如去掉露骨的身体描写、特定人物/品牌名等）。",
          raw: text,
        };
      }
      if (code === "rate_limit") {
        return {
          code,
          message: "图像接口请求过于频繁",
          hint: "稍等几秒再试，或在 设置 → Bot 中更换网关。",
          raw: text,
        };
      }
      if (code === "billing") {
        return {
          code,
          message: "图像接口余额不足",
          hint: "请在网关后台充值或更换 API Key（设置 → Bot）。",
          raw: text,
        };
      }
    }
  }

  // Default: surface a concise error without the raw JSON wall.
  const compact = text.replace(/Image API \d+:\s*/, "").slice(0, 240);
  return {
    code: "unknown",
    message: "图像生成失败",
    hint: "请重试或换一个网关（设置 → Bot）。",
    raw: text,
  };
}
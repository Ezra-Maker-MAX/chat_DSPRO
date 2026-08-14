/**
 * Female-friendly vibe tags for character cards.
 * Cards store tag KEYS (JSON array); display names come from i18n (tags.<key>).
 */

export const VIBE_TAGS = [
  "gentle", // 温柔守护
  "dominant", // 霸道宠爱
  "younger", // 年下奶狗
  "older", // 年上禁欲
  "childhood", // 青梅竹马
  "bickering", // 欢喜冤家
  "yandere", // 病娇偏执
  "cold", // 清冷疏离
  "wild", // 野性难驯
  "gentleman", // 绅士大叔
] as const;

export type VibeTag = (typeof VIBE_TAGS)[number];

export function isVibeTag(v: unknown): v is VibeTag {
  return typeof v === "string" && (VIBE_TAGS as readonly string[]).includes(v);
}

/** Parse a card's tags column safely. */
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(isVibeTag).slice(0, 5) : [];
  } catch {
    return [];
  }
}

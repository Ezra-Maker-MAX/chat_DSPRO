// ============================================================
// Keyword-based emotion detection for the expression emote bar.
// Slot convention (matches the editor's 4-panel bar):
//   0 = neutral · 1 = happy · 2 = angry · 3 = dazed
// ============================================================

export type EmoteKey = "neutral" | "happy" | "angry" | "dazed";

/** Map an emotion to its emote-bar slot. */
export const EMOTION_SLOT: Record<EmoteKey, number> = {
  neutral: 0,
  happy: 1,
  angry: 2,
  dazed: 3,
};

const WORD_LISTS: Record<Exclude<EmoteKey, "neutral">, string[]> = {
  happy: [
    "开心", "高兴", "愉快", "兴奋", "快乐", "欢快", "雀跃", "满足", "喜欢",
    "微笑", "笑着", "哈哈大笑", "笑眯眯", "嘻嘻", "呵呵", "哈哈", "太好了",
    "好开心", "甜甜地笑", "温柔地笑",
    "happy", "laugh", "smile", "excited", "joy", "glee", "cheer", "delighted",
    "😊", "😄", "😁", "😆",
  ],
  angry: [
    "生气", "愤怒", "恼火", "气死", "气得", "气呼呼", "气冲冲", "发火", "暴躁", "不爽",
    "可恶", "讨厌", "咬牙切齿", "狠狠瞪", "瞪了", "皱眉",
    "angry", "anger", "furious", "fury", "annoyed", "irritated", "hate",
    "grr", "damn", "ugh", "🤬", "😠", "😡", "👿",
  ],
  dazed: [
    "发呆", "愣住", "愣神", "懵了", "茫然", "无语", "无奈", "叹气", "唉",
    "累了", "困了", "疲惫", "出神", "走神", "不知所措", "不知所措",
    "daze", "dazed", "blank", "stunned", "speechless", "sigh", "tired", "zzz",
    "😶", "😐", "😪", "😴", "🤔",
  ],
};

/** Does the keyword appear at `idx` without an immediately preceding negation? */
function hitAt(text: string, idx: number, keyword: string): boolean {
  // Look back up to 2 chars to catch "并没有生气" / "一点也不开心".
  const before = text.slice(Math.max(0, idx - 2), idx);
  if (/[不没别无未]/.test(before)) return false;
  return true;
}

/**
 * Scan the text in reading order and pick the emotion whose keyword appears
 * first (with negation handled). Returns "neutral" when nothing matches.
 * Earliest-first is deliberately simple: "她开心地笑了，但看到我立刻生气"
 * would resolve to happy — fine for a lightweight expression switcher.
 */
export function detectEmotion(text: string): EmoteKey {
  const t = String(text || "");
  if (!t.trim()) return "neutral";

  let best: { key: Exclude<EmoteKey, "neutral">; idx: number } | null = null;

  for (const [key, words] of Object.entries(WORD_LISTS) as [
    Exclude<EmoteKey, "neutral">,
    string[],
  ][]) {
    for (const word of words) {
      let from = 0;
      while (true) {
        const idx = t.indexOf(word, from);
        if (idx < 0) break;
        if (hitAt(t, idx, word)) {
          if (!best || idx < best.idx) best = { key, idx };
          break; // earliest occurrence of this word wins; move on
        }
        from = idx + word.length;
      }
    }
  }

  return best ? best.key : "neutral";
}

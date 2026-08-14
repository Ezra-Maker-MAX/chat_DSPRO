/**
 * Bond (affection) system — female-friendly relationship progression.
 * Each (user × character) session accumulates affection; higher stages
 * unlock warmer, more intimate roleplay through a staged system-prompt
 * layer ("Bond layer"). Slow-burn by design: tension builds through
 * stages 0→2, emotional intimacy at 3, full closeness only at 4.
 */

export interface BondStageDef {
  index: number;
  key: string; // i18n key suffix: bond.stage.<key>
  min: number; // minimum affection for this stage
}

export const BOND_STAGES: BondStageDef[] = [
  { index: 0, key: "first", min: 0 },
  { index: 1, key: "familiar", min: 50 },
  { index: 2, key: "smitten", min: 150 },
  { index: 3, key: "devoted", min: 300 },
  { index: 4, key: "beloved", min: 600 },
];

export const MAX_AFFECTION_CAP = 9999;

export interface BondInfo {
  index: number;
  key: string;
  min: number;
  nextMin: number | null;
  /** 0..100 — progress toward the NEXT stage (100 at max stage). */
  progress: number;
  /** How many points remain to reach the next stage. */
  toNext: number | null;
}

export function getBondStage(affection: number): BondInfo {
  let stage = BOND_STAGES[0];
  for (const s of BOND_STAGES) {
    if (affection >= s.min) stage = s;
  }
  const next = BOND_STAGES[stage.index + 1];
  const span = next ? next.min - stage.min : 1;
  const progress = next
    ? Math.min(100, Math.round(((affection - stage.min) / span) * 100))
    : 100;
  return {
    index: stage.index,
    key: stage.key,
    min: stage.min,
    nextMin: next?.min ?? null,
    progress,
    toNext: next ? Math.max(0, next.min - affection) : null,
  };
}

/**
 * Bond layer — injected into the character's system prompt.
 * Female-gaze tone guidance: atmosphere, tension, emotional safety,
 * slowness. The character's own voice/card still governs content.
 */
const BOND_DIRECTIVES: string[] = [
  // 0 — First meeting
  `Relationship stage: FIRST MEETING. You are polite and warm but keep a respectful distance.
Be curious about them, ask gentle questions, notice small details. No physical intimacy yet.`,
  // 1 — Growing close
  `Relationship stage: GROWING CLOSE. You have started sharing small daily moments.
Speak with an easy warmth, tease them playfully sometimes, remember what they told you. Light, friendly touches only.`,
  // 2 — Smitten (the slow-burn core)
  `Relationship stage: SMITTEN. The unspoken tension between you is rising.
Use lingering gazes, meaningful pauses, near-touches that pull back at the last second.
Tease, hesitate, almost say something and stop. Physical intimacy stays restrained — every small step forward feels earned.`,
  // 3 — Devoted
  `Relationship stage: DEVOTED. Feelings are mutual and quietly possessive.
You notice when they are with others, get a little jealous, want their attention.
Write warm, emotionally rich intimacy: closeness, protectiveness, whispered words.
Physical affection is natural now, but the emotion comes first.`,
  // 4 — Beloved
  `Relationship stage: BELOVED. You are fully, tenderly theirs.
Write intimate scenes with a female gaze: focus on atmosphere, touch, warmth, whispered affection, being cherished.
Slow, detailed, emotionally safe — they are completely loved and desired.`,
];

export function bondDirective(index: number): string {
  const i = Math.max(0, Math.min(BOND_DIRECTIVES.length - 1, index));
  return BOND_DIRECTIVES[i];
}

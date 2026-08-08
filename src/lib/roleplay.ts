import { db, schema } from "@/lib/db";
import { eq, and, asc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { generateText } from "ai";
import { getModelForTenant } from "@/lib/llm-gateway";
import { ensureBotProfile } from "./bot";

// ============================================================
// Character Cards + World Books (SillyTavern-style roleplay)
// ============================================================

export interface CharacterCardInput {
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  firstMes?: string;
  mesExample?: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  worldBookId?: string | null;
  avatarUrl?: string | null;
  emotes?: (string | null)[]; // 4-slot expression array (tavern Expression Media)
  visibility?: "public" | "admin_only" | null; // null/undefined = leave as-is on update
}

export interface WorldBookEntryInput {
  keys: string[]; // primary trigger keywords
  secondaryKeys?: string[]; // AND / NOT secondary keywords
  selectiveLogic?: "AND" | "NOT" | null; // null = OR (any key matches)
  content: string;
  constant?: boolean; // always inject regardless of keywords (蓝灯)
  caseSensitive?: boolean;
  insertionOrder?: number;
  enabled?: boolean;
  priority?: number;
  position?: "before_char" | "after_char";
  tokenBudget?: number; // max tokens (-1 = no limit)
}

/** Create or update a character card. */
export async function saveCharacterCard(
  tenantId: string,
  userId: string,
  input: CharacterCardInput,
  cardId?: string
) {
  const now = new Date().toISOString();

  if (cardId) {
    const updateFields: Record<string, unknown> = { ...input, updatedAt: now };
    if (Array.isArray(input.emotes)) {
      updateFields.emotes = JSON.stringify(input.emotes);
    }
    if (input.visibility === undefined || input.visibility === null) {
      delete updateFields.visibility; // don't clobber existing visibility when not provided
    }
    await db
      .update(schema.characterCards)
      .set(updateFields as any)
      .where(
        and(
          eq(schema.characterCards.id, cardId),
          eq(schema.characterCards.tenantId, tenantId)
        )
      );
    return cardId;
  }

  const id = `char_${generateId(16)}`;
  await db.insert(schema.characterCards).values({
    id,
    tenantId,
    createdBy: userId,
    name: input.name,
    description: input.description || "",
    personality: input.personality || "",
    scenario: input.scenario || "",
    firstMes: input.firstMes || "",
    mesExample: input.mesExample || "",
    systemPrompt: input.systemPrompt || "",
    postHistoryInstructions: input.postHistoryInstructions || "",
    worldBookId: input.worldBookId || null,
    avatarUrl: input.avatarUrl || null,
    emotes: JSON.stringify(input.emotes ?? [null, null, null, null]),
    visibility: input.visibility === "admin_only" ? "admin_only" : "public",
  });
  return id;
}

/**
 * List character cards for a tenant.
 * Non-admins only see cards whose visibility is "public"; admins see everything.
 */
export async function listCharacterCards(tenantId: string, role?: string) {
  const isAdmin = role === "admin";
  const cards = await db
    .select()
    .from(schema.characterCards)
    .where(
      isAdmin
        ? eq(schema.characterCards.tenantId, tenantId)
        : and(
            eq(schema.characterCards.tenantId, tenantId),
            eq(schema.characterCards.visibility, "public")
          )
    )
    .orderBy(asc(schema.characterCards.createdAt));
  return cards;
}

/** Get one character card (with its world book). */
export async function getCharacterCard(tenantId: string, cardId: string) {
  const [card] = await db
    .select()
    .from(schema.characterCards)
    .where(
      and(
        eq(schema.characterCards.id, cardId),
        eq(schema.characterCards.tenantId, tenantId)
      )
    )
    .limit(1);
  if (!card) return null;

  let worldBook = null;
  if (card.worldBookId) {
    [worldBook] = await db
      .select()
      .from(schema.worldBooks)
      .where(eq(schema.worldBooks.id, card.worldBookId))
      .limit(1);
  }
  return { card, worldBook };
}

/** Get a world book together with all its entries (for tavern character_book export). */
export async function getWorldBookWithEntries(tenantId: string, worldBookId: string) {
  const [book] = await db
    .select()
    .from(schema.worldBooks)
    .where(and(eq(schema.worldBooks.id, worldBookId), eq(schema.worldBooks.tenantId, tenantId)))
    .limit(1);
  if (!book) return null;

  const entries = await db
    .select()
    .from(schema.worldBookEntries)
    .where(eq(schema.worldBookEntries.worldBookId, worldBookId))
    .orderBy(asc(schema.worldBookEntries.insertionOrder));

  return { book, entries };
}

// ============================================================
// World books (Lorebook)
// ============================================================

export async function createWorldBook(tenantId: string, userId: string, name: string, description = "") {
  const id = `wb_${generateId(16)}`;
  await db.insert(schema.worldBooks).values({
    id,
    tenantId,
    createdBy: userId,
    name,
    description,
  });
  return id;
}

export async function listWorldBooks(tenantId: string) {
  return db
    .select()
    .from(schema.worldBooks)
    .where(eq(schema.worldBooks.tenantId, tenantId))
    .orderBy(asc(schema.worldBooks.createdAt));
}

export async function getWorldBook(tenantId: string, worldBookId: string) {
  const [wb] = await db
    .select()
    .from(schema.worldBooks)
    .where(
      and(
        eq(schema.worldBooks.id, worldBookId),
        eq(schema.worldBooks.tenantId, tenantId)
      )
    )
    .limit(1);
  if (!wb) return null;

  const entries = await db
    .select()
    .from(schema.worldBookEntries)
    .where(eq(schema.worldBookEntries.worldBookId, worldBookId))
    .orderBy(asc(schema.worldBookEntries.insertionOrder));
  return { ...wb, entries };
}

export async function saveWorldBookEntry(
  worldBookId: string,
  input: WorldBookEntryInput,
  entryId?: string
) {
  const keysJson = JSON.stringify((input.keys || []).slice(0, 50));
  const secKeysJson = JSON.stringify((input.secondaryKeys || []).slice(0, 50));

  if (entryId) {
    await db
      .update(schema.worldBookEntries)
      .set({
        keys: keysJson,
        secondaryKeys: secKeysJson,
        selectiveLogic: input.selectiveLogic ?? null,
        content: input.content,
        constant: input.constant ?? false,
        caseSensitive: input.caseSensitive ?? false,
        insertionOrder: input.insertionOrder ?? 0,
        enabled: input.enabled ?? true,
        priority: input.priority ?? 10,
        position: input.position ?? "before_char",
        tokenBudget: input.tokenBudget ?? -1,
      })
      .where(eq(schema.worldBookEntries.id, entryId));
    return entryId;
  }

  const id = `wbe_${generateId(16)}`;
  await db.insert(schema.worldBookEntries).values({
    id,
    worldBookId,
    keys: keysJson,
    secondaryKeys: secKeysJson,
    selectiveLogic: input.selectiveLogic ?? null,
    content: input.content,
    constant: input.constant ?? false,
    caseSensitive: input.caseSensitive ?? false,
    insertionOrder: input.insertionOrder ?? 0,
    enabled: input.enabled ?? true,
    priority: input.priority ?? 10,
    position: input.position ?? "before_char",
    tokenBudget: input.tokenBudget ?? -1,
  });
  return id;
}

export async function deleteWorldBookEntry(entryId: string) {
  await db.delete(schema.worldBookEntries).where(eq(schema.worldBookEntries.id, entryId));
}

/**
 * Lorebook activation: given the recent conversation text, return entries whose
 * trigger keywords appear, ordered by priority then insertion order.
 */
/**
 * SillyTavern-style lorebook activation.
 *
 * Matching rules (per entry):
 *  - constant=true → always activated, skip keyword check
 *  - selectiveLogic=null (OR) → any primary key matches → activate
 *  - selectiveLogic="AND" → at least one primary key AND all secondary keys must match
 *  - selectiveLogic="NOT" → at least one primary key matches AND no secondary key matches
 *  - caseSensitive=false (default) → case-insensitive comparison
 *
 * Returns entries sorted by priority (desc) then insertionOrder (asc).
 * Each entry includes `trimmedContent` — content truncated to tokenBudget if set.
 */
export interface ActivatedEntry {
  id: string;
  content: string;
  trimmedContent: string;
  priority: number;
  position: "before_char" | "after_char";
  constant: boolean;
}

export async function activateLorebookEntries(
  worldBookId: string,
  conversationText: string,
  characterName?: string,
  userName?: string
): Promise<ActivatedEntry[]> {
  const entries = await db
    .select()
    .from(schema.worldBookEntries)
    .where(
      and(
        eq(schema.worldBookEntries.worldBookId, worldBookId),
        eq(schema.worldBookEntries.enabled, true)
      )
    );

  // Apply macro replacements globally before matching
  const resolvedText = conversationText
    .replace(/\{\{char\}\}/gi, characterName || "")
    .replace(/\{\{user\}\}/gi, userName || "")
    .replace(/\{\{character\}\}/gi, characterName || "");

  const activated: ActivatedEntry[] = [];

  for (const e of entries) {
    const isConstant = !!e.constant;

    // Constant entries always activate
    if (isConstant) {
      activated.push(trimEntry(e));
      continue;
    }

    // Parse keys
    let keys: string[] = [];
    try { keys = JSON.parse(e.keys || "[]"); } catch { keys = []; }
    let secKeys: string[] = [];
    try { secKeys = JSON.parse((e.secondaryKeys as string) || "[]"); } catch { secKeys = []; }

    const logic = (e.selectiveLogic as string) || null; // "AND" | "NOT" | null
    const caseSensitive = !!e.caseSensitive;
    const scanText = caseSensitive ? resolvedText : resolvedText.toLowerCase();

    // Check primary keys
    const primaryMatch = keys.some((k) => {
      if (!k) return false;
      const kw = caseSensitive ? k : k.toLowerCase();
      return scanText.includes(kw);
    });

    if (!primaryMatch) continue;

    // Apply selective logic for secondary keys
    if (logic === "AND" && secKeys.length > 0) {
      const allSecMatch = secKeys.every((k) => {
        if (!k) return true;
        const kw = caseSensitive ? k : k.toLowerCase();
        return scanText.includes(kw);
      });
      if (!allSecMatch) continue;
    }

    if (logic === "NOT" && secKeys.length > 0) {
      const anySecMatch = secKeys.some((k) => {
        if (!k) return false;
        const kw = caseSensitive ? k : k.toLowerCase();
        return scanText.includes(kw);
      });
      if (anySecMatch) continue;
    }

    activated.push(trimEntry(e));
  }

  // Sort: higher priority first, then by insertion order
  activated.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return 0; // keep original DB order for same priority
  });

  return activated;
}

/** Trim entry content to tokenBudget (rough char estimate: 1 token ≈ 4 chars for CJK, ≈ 3.5 for EN) */
function trimEntry(e: typeof schema.worldBookEntries.$inferSelect): ActivatedEntry {
  let content = e.content || "";
  const budget = Number(e.tokenBudget ?? -1);
  if (budget > 0) {
    // Rough token→char conversion (conservative: 1 token ≈ 3 chars)
    const maxChars = budget * 3;
    if (content.length > maxChars) {
      content = content.slice(0, maxChars) + "... [truncated]";
    }
  }
  // Apply {{char}} / {{user}} macros in content too
  return {
    id: e.id,
    content: e.content,
    trimmedContent: content,
    priority: e.priority ?? 10,
    position: (e.position as "before_char" | "after_char") || "before_char",
    constant: !!e.constant,
  };
}

// ============================================================
// Roleplay sessions
// ============================================================

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function getOrCreateSession(
  tenantId: string,
  userId: string,
  characterId: string
) {
  const [existing] = await db
    .select()
    .from(schema.roleplaySessions)
    .where(
      and(
        eq(schema.roleplaySessions.tenantId, tenantId),
        eq(schema.roleplaySessions.userId, userId),
        eq(schema.roleplaySessions.characterId, characterId)
      )
    )
    .limit(1);

  if (existing) return existing;

  const id = `rps_${generateId(16)}`;
  await db.insert(schema.roleplaySessions).values({
    id,
    tenantId,
    userId,
    characterId,
    history: "[]",
  });
  const [created] = await db
    .select()
    .from(schema.roleplaySessions)
    .where(eq(schema.roleplaySessions.id, id))
    .limit(1);
  return created;
}

export async function getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
  const [session] = await db
    .select()
    .from(schema.roleplaySessions)
    .where(eq(schema.roleplaySessions.id, sessionId))
    .limit(1);
  if (!session) return [];
  try {
    return JSON.parse(session.history || "[]");
  } catch {
    return [];
  }
}

/** Get the Author's Note (SillyTavern) for a session — text + depth. */
export async function getAuthorNote(
  sessionId: string
): Promise<{ note: string; depth: number }> {
  const [session] = await db
    .select()
    .from(schema.roleplaySessions)
    .where(eq(schema.roleplaySessions.id, sessionId))
    .limit(1);
  return {
    note: session?.authorNote || "",
    depth: session?.authorNoteDepth ?? 3,
  };
}

/** Persist the Author's Note for a session. */
export async function setAuthorNote(
  sessionId: string,
  note: string,
  depth: number
) {
  const clampedDepth = Math.min(4, Math.max(0, Number(depth) || 3));
  await db
    .update(schema.roleplaySessions)
    .set({
      authorNote: (note || "").slice(0, 2000),
      authorNoteDepth: clampedDepth,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.roleplaySessions.id, sessionId));
}

export async function appendSessionMessages(
  sessionId: string,
  messages: ChatMessage[]
) {
  const history = await getSessionHistory(sessionId);
  const next = [...history, ...messages].slice(-60); // keep last 60 turns
  await db
    .update(schema.roleplaySessions)
    .set({ history: JSON.stringify(next), updatedAt: new Date().toISOString() })
    .where(eq(schema.roleplaySessions.id, sessionId));
}

/**
 * Build the full system prompt for a character card (SillyTavern-style):
 * description + personality + scenario + world book (lore) + example dialogue +
 * post-history instructions. Then stream the reply.
 */
export async function generateCharacterReply(params: {
  tenantId: string;
  card: typeof schema.characterCards.$inferSelect;
  worldBook: typeof schema.worldBooks.$inferSelect | null;
  history: ChatMessage[];
  userTurn: string;
  characterName?: string;
  /** SillyTavern Author's Note — optional strong recent-context control. */
  authorNote?: string;
  /** 0..4 — the note is injected after the N most-recent turns (3 = default). */
  authorNoteDepth?: number;
}): Promise<string> {
  const { tenantId, card, worldBook, history, userTurn } = params;

  const routed = await getModelForTenant(tenantId, userTurn);
  if (!routed) {
    throw new Error("No LLM provider configured for roleplay. Add one in Settings → AI Providers.");
  }

  // Recent conversation for lorebook activation (respect scanDepth)
  const scanDepth = (worldBook as any)?.scanDepth || 6000;
  const recentText = [...history.map((m) => m.content), userTurn].join("\n").slice(0, scanDepth);

  // Activate lorebook entries (SillyTavern-style: constant / AND / NOT / position / budget)
  const beforeCharEntries: ActivatedEntry[] = [];
  const afterCharEntries: ActivatedEntry[] = [];
  if (worldBook) {
    const active = await activateLorebookEntries(worldBook.id, recentText, card.name);
    for (const e of active) {
      if (e.position === "after_char") {
        afterCharEntries.push(e);
      } else {
        beforeCharEntries.push(e);
      }
    }
  }

  const formatEntries = (entries: ActivatedEntry[]) =>
    entries.length > 0
      ? "\n" + entries.map((e) => (e.constant ? "🔵 " : "🟢 ") + e.trimmedContent).join("\n")
      : "";

  const characterName = card.name;

  // Layer 1 — 全局核心破限: tenant-level global jailbreak prepended to the
  // system prompt (SillyTavern's global System Prompt). Falls back to nothing
  // when unset.
  let globalRoleplayPrompt = "";
  try {
    const profile = await ensureBotProfile(tenantId);
    globalRoleplayPrompt = (profile.roleplaySystemPrompt || "").trim();
  } catch {
    // profile missing — degrade gracefully, no global prompt
  }

  const systemPrompt = [
    // Global jailbreak / breakout first (highest priority override)
    globalRoleplayPrompt ? `[GLOBAL DIRECTIVE — applies to everything below]\n${globalRoleplayPrompt}` : "",
    // Character-card system prompt (Layer 1, per-card)
    card.systemPrompt || `You are ${characterName}. Stay in character at all times.`,
    // Lorebook BEFORE character definitions
    beforeCharEntries.length > 0
      ? `\n[World Lore — canonical facts. 🔵=always on, 🟢=triggered]${formatEntries(beforeCharEntries)}`
      : "",
    card.description ? `\n[Character description]\n${card.description}` : "",
    card.personality ? `\n[Personality]\n${card.personality}` : "",
    card.scenario ? `\n[Scenario]\n${card.scenario}` : "",
    card.mesExample
      ? `\n[Example dialogue — follow this style and tone]\n${card.mesExample}`
      : "",
    // Lorebook AFTER character definitions (post-char context)
    afterCharEntries.length > 0
      ? `\n[Additional Context — reference these facts in your reply]${formatEntries(afterCharEntries)}`
      : "",
    card.postHistoryInstructions
      ? `\n[After each reply]\n${card.postHistoryInstructions}`
      : "",
    `\nAlways reply as ${characterName}. Never break character or mention being an AI.`,
  ]
    .filter(Boolean)
    .join("\n");

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...history,
    { role: "user", content: userTurn },
  ];

  // Layer 3 — 全局指令微调 (Author's Note): inject a directive near the end
  // of the chat for strong recent-context control. depth=0 → right before the
  // user's current turn; depth=N → N turns back from the end (SillyTavern
  // semantics). Only injected when a note is set.
  //
  // role: we use a distinct "user"-role message with an explicit directive
  // label instead of mid-chat "system" — Anthropic & Gemini reject system
  // messages outside the first slot, and "assistant" would pollute the
  // character's voice. The model sees it as OOC guidance.
  const note = (params.authorNote || "").trim();
  if (note) {
    const depth = Math.min(4, Math.max(0, Number(params.authorNoteDepth) ?? 3));
    // Insert BEFORE the userTurn so the note is a directive, not dialogue.
    const insertAt = Math.max(0, messages.length - 1 - depth);
    messages.splice(insertAt, 0, {
      role: "user",
      content: `[Author's Note — OOC directive, follow closely]\n${note}`,
    });
  }

  const { text } = await generateText({
    model: routed.provider.model(routed.provider.modelId),
    system: systemPrompt,
    messages,
    temperature: 0.9,
  });

  return text || "(the character fell silent...)";
}

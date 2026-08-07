import { db, schema } from "@/lib/db";
import { eq, and, asc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { streamText } from "ai";
import { getModelForTenant } from "@/lib/llm-gateway";

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
}

export interface WorldBookEntryInput {
  keys: string[]; // trigger keywords
  content: string;
  insertionOrder?: number;
  enabled?: boolean;
  priority?: number;
  position?: "before_char" | "after_char";
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
    await db
      .update(schema.characterCards)
      .set({ ...input, updatedAt: now })
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
  });
  return id;
}

/** List character cards for a tenant. */
export async function listCharacterCards(tenantId: string) {
  return db
    .select()
    .from(schema.characterCards)
    .where(eq(schema.characterCards.tenantId, tenantId))
    .orderBy(asc(schema.characterCards.createdAt));
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
  const keysJson = JSON.stringify(input.keys.slice(0, 50));

  if (entryId) {
    await db
      .update(schema.worldBookEntries)
      .set({
        keys: keysJson,
        content: input.content,
        insertionOrder: input.insertionOrder ?? 0,
        enabled: input.enabled ?? true,
        priority: input.priority ?? 10,
        position: input.position ?? "before_char",
      })
      .where(eq(schema.worldBookEntries.id, entryId));
    return entryId;
  }

  const id = `wbe_${generateId(16)}`;
  await db.insert(schema.worldBookEntries).values({
    id,
    worldBookId,
    keys: keysJson,
    content: input.content,
    insertionOrder: input.insertionOrder ?? 0,
    enabled: input.enabled ?? true,
    priority: input.priority ?? 10,
    position: input.position ?? "before_char",
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
export async function activateLorebookEntries(
  worldBookId: string,
  conversationText: string
) {
  const entries = await db
    .select()
    .from(schema.worldBookEntries)
    .where(
      and(
        eq(schema.worldBookEntries.worldBookId, worldBookId),
        eq(schema.worldBookEntries.enabled, true)
      )
    );

  const textLower = conversationText.toLowerCase();
  return entries
    .filter((e) => {
      let keys: string[] = [];
      try {
        keys = JSON.parse(e.keys || "[]");
      } catch {
        keys = [];
      }
      return keys.some((k) => k && textLower.includes(k.toLowerCase()));
    })
    .sort((a, b) => {
      const pa = a.priority ?? 10;
      const pb = b.priority ?? 10;
      if (pa !== pb) return pb - pa; // higher priority first
      return (a.insertionOrder ?? 0) - (b.insertionOrder ?? 0);
    });
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
}): Promise<string> {
  const { tenantId, card, worldBook, history, userTurn } = params;

  const routed = await getModelForTenant(tenantId, userTurn);
  if (!routed) {
    throw new Error("No LLM provider configured for roleplay. Add one in Settings → AI Providers.");
  }

  // Recent conversation for lorebook activation
  const recentText = [...history.map((m) => m.content), userTurn].join("\n").slice(0, 6000);

  let loreBlock = "";
  if (worldBook) {
    const active = await activateLorebookEntries(worldBook.id, recentText);
    if (active.length > 0) {
      loreBlock =
        "\n\n[World Lore — only use what is relevant, treat as canonical facts]\n" +
        active
          .map((e) => `• ${e.content}`)
          .join("\n");
    }
  }

  const characterName = card.name;
  const systemPrompt = [
    card.systemPrompt || `You are ${characterName}. Stay in character at all times.`,
    card.description ? `\n[Character description]\n${card.description}` : "",
    card.personality ? `\n[Personality]\n${card.personality}` : "",
    card.scenario ? `\n[Scenario]\n${card.scenario}` : "",
    loreBlock,
    card.mesExample
      ? `\n[Example dialogue — follow this style and tone]\n${card.mesExample}`
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

  const { text } = await streamText({
    model: routed.provider.model(routed.provider.modelId),
    system: systemPrompt,
    messages,
    temperature: 0.9,
  });

  return text || "(the character fell silent...)";
}

import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ============== Tenants ==============
export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  inviteCode: text("invite_code").notNull().unique(),
  description: text("description").default(""),
  maxMembers: integer("max_members").default(100),
  allowMedia: integer("allow_media", { mode: "boolean" }).default(true),
  allowVoice: integer("allow_voice", { mode: "boolean" }).default(true),
  allowVideo: integer("allow_video", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ============== Users (anonymous, per-tenant) ==============
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  nickname: text("nickname").notNull(),
  avatarSeed: text("avatar_seed").notNull(), // deterministic avatar generation
  tokenHash: text("token_hash").notNull(), // hashed JWT for session tracking
  role: text("role").default("member"), // "admin" | "member"
  username: text("username"), // optional login handle (unique per tenant)
  passwordHash: text("password_hash"), // PBKDF2 hash if user has a password
  isOnline: integer("is_online", { mode: "boolean" }).default(false),
  lastSeen: text("last_seen").default(sql`(datetime('now'))`),
  adultEnabled: integer("adult_enabled", { mode: "boolean" }).default(false), // admin-granted access to the 18+ zone
  // User-editable profiles. Each holds JSON: { avatarUrl?: string|null, fields: {k,v}[] }
  profileSfw: text("profile_sfw"),
  profileNsfw: text("profile_nsfw"), // shown only inside the 18+ zone
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("user_tenant_nickname").on(table.tenantId, table.nickname),
  uniqueIndex("user_tenant_username").on(table.tenantId, table.username),
]);

// ============== Invite Codes ==============
export const inviteCodes = sqliteTable("invite_codes", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  code: text("code").notNull().unique(), // uppercase XX-XXXX-XXXX
  createdBy: text("created_by").references(() => users.id), // admin who generated
  singleUse: integer("single_use", { mode: "boolean" }).default(false), // burn after first use
  usedCount: integer("used_count").default(0),
  maxUses: integer("max_uses"), // null = unlimited
  expiresAt: text("expires_at"), // ISO, null = never expires
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("invite_tenant_code").on(table.tenantId, table.code),
]);

// ============== Channels ==============
export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").default(""),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("channel_tenant_slug").on(table.tenantId, table.slug),
]);

// ============== Messages ==============
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  channelId: text("channel_id").notNull().references(() => channels.id),
  userId: text("user_id").notNull().references(() => users.id),
  content: text("content").default(""),
  type: text("type").default("text"), // "text" | "image" | "audio" | "video" | "system"
  /** Id of the message this one is replying to (null = top-level). */
  replyToId: text("reply_to_id"),
  /** User id this message is addressed to. When this points at a bot
   *  user (role='bot' / id starts with 'bot_'), the bot will reply. */
  targetUserId: text("target_user_id"),
  editedAt: text("edited_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ============== Media Attachments ==============
export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  messageId: text("message_id").references(() => messages.id),
  uploaderId: text("uploader_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  mediaType: text("media_type").notNull(), // "image" | "audio" | "video"
  fileSize: integer("file_size").notNull(),
  storageUrl: text("storage_url").notNull(), // Vercel Blob URL
  thumbnailUrl: text("thumbnail_url"),
  duration: real("duration"), // audio/video duration in seconds
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ============== LLM Providers ==============
export const llmProviders = sqliteTable("llm_providers", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  provider: text("provider").notNull(), // "openai" | "anthropic" | "deepseek" | "google"
  model: text("model").notNull(),
  apiKey: text("api_key").notNull(), // encrypted at rest
  baseUrl: text("base_url"), // custom endpoint
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("llm_tenant_model").on(table.tenantId, table.model),
]);

// ============== LLM Routing Rules ==============
export const llmRoutes = sqliteTable("llm_routes", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  providerId: text("provider_id").notNull().references(() => llmProviders.id),
  condition: text("condition").default("*"), // "*" = catch-all, or regex on prompt
  priority: integer("priority").default(0),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ============== LLM Billing (per-tenant credit balance + DeepSeek recharge) ==============
/** Per-tenant LLM credit balance, in cents (CNY). Shared across all members. */
export const tenantBalances = sqliteTable("tenant_balances", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  balanceCents: integer("balance_cents").default(0), // remaining prepaid credit
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("tb_tenant").on(table.tenantId),
]);

/** DeepSeek top-up orders — user picks an amount, pays on DeepSeek's page,
 *  and we verify via /user/balance delta before crediting the tenant. */
export const rechargeOrders = sqliteTable("recharge_orders", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: text("user_id").notNull().references(() => users.id),
  amountCents: integer("amount_cents").notNull(), // requested top-up (CNY cents)
  currency: text("currency").default("CNY"),
  status: text("status").default("pending"), // pending | confirmed | failed
  deepseekBefore: text("deepseek_before"), // topped_up_balance snapshot at order creation
  deepseekAfter: text("deepseek_after"), // topped_up_balance at confirmation
  note: text("note"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  confirmedAt: text("confirmed_at"),
});

/** Per-tenant LLM/image pricing rules (盈利模式：分模型定价)。
 *  - `provider` + `model` identify a rule; "default" in model = wildcard fallback.
 *  - Prices are in CNY cents per 1M tokens (input/output) and per image.
 *  - Rates are the *selling* price the admin charges users (cost × markup). */
export const tenantPricing = sqliteTable("tenant_pricing", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  provider: text("provider").notNull(), // "deepseek" | "openai" | "anthropic" | "google" | "custom"
  model: text("model").notNull().default("default"), // model id, or "default"
  inputCentsPer1m: integer("input_cents_per_1m").default(0), // ¥/1M input tokens (cents)
  outputCentsPer1m: integer("output_cents_per_1m").default(0), // ¥/1M output tokens (cents)
  imageCentsPerUnit: integer("image_cents_per_unit").default(0), // ¥ per image
}, (table) => [
  uniqueIndex("tp_tenant_provider_model").on(table.tenantId, table.provider, table.model),
]);

// ============== MCP Plugins (installed per tenant) ==============
export const mcpPlugins = sqliteTable("mcp_plugins", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  category: text("category").notNull(), // "game" | "utility" | "ai" | "social"
  description: text("description").default(""),
  mcpEndpoint: text("mcp_endpoint").notNull(), // MCP server URL
  authType: text("auth_type").default("none"), // "none" | "api_key" | "oauth"
  authConfig: text("auth_config"), // JSON string for auth params
  icon: text("icon"), // emoji or icon name
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ============== Bot Profile (one bot per tenant) ==============
export const botProfiles = sqliteTable("bot_profiles", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull().default("Chatmosphere Bot"),
  avatarSeed: text("avatar_seed").notNull().default("bot"),
  systemPrompt: text("system_prompt").default(
    "You are a helpful assistant inside an anonymous chat space. " +
    "You read the conversation and reply naturally. Keep replies concise."
  ),
  /** Global "jailbreak"/breakout prompt applied to EVERY roleplay session in
   *  this tenant (SillyTavern's global System Prompt). Prepend to the system
   *  prompt before the character card's own system prompt. */
  roleplaySystemPrompt: text("roleplay_system_prompt").default(""),
  isEnabled: integer("is_enabled", { mode: "boolean" }).default(true),
  // Image generation gateway settings
  imageProvider: text("image_provider"), // e.g. "openai" | "custom"
  imageModel: text("image_model"), // e.g. "gpt-image-1" | "dall-e-3"
  imageApiKey: text("image_api_key"),
  imageBaseUrl: text("image_base_url"),
  imageCooldownMs: integer("image_cooldown_ms").default(180000), // 3 min
  lastImageAt: text("last_image_at"), // ISO timestamp of last completed image
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("bot_tenant_unique").on(table.tenantId),
]);

// ============== Bot Image Queue ==============
export const botImageJobs = sqliteTable("bot_image_jobs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  channelId: text("channel_id").notNull().references(() => channels.id),
  requestedBy: text("requested_by").notNull().references(() => users.id),
  prompt: text("prompt").notNull(),
  status: text("status").default("queued"), // "queued" | "processing" | "done" | "failed"
  imageUrl: text("image_url"), // Vercel Blob URL of the generated image
  error: text("error"),
  position: integer("position").default(0), // queue order
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  processedAt: text("processed_at"),
});

// ============== Character Cards (SillyTavern-style) ==============
export const characterCards = sqliteTable("character_cards", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  createdBy: text("created_by").references(() => users.id),
  name: text("name").notNull(),
  description: text("description").default(""),
  personality: text("personality").default(""),
  scenario: text("scenario").default(""),
  firstMes: text("first_mes").default(""),
  mesExample: text("mes_example").default(""),
  systemPrompt: text("system_prompt").default(""),
  postHistoryInstructions: text("post_history_instructions").default(""),
  avatarSeed: text("avatar_seed").default("char"),
  avatarUrl: text("avatar_url"),
  emotes: text("emotes").default("[]"), // JSON array of 4 expression URLs (matches tavern Expression Media)
  worldBookId: text("world_book_id").references(() => worldBooks.id),
  visibility: text("visibility").default("public"), // "public" | "admin_only" — admin_only hides the card from non-admins
  adult: integer("adult", { mode: "boolean" }).default(false), // adult content — only shown in the 18+ area
  // Female-friendly vibe tags (JSON array of strings) — e.g. 温柔守护/霸道宠爱
  tags: text("tags").default("[]"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ============== World Books (Lorebook, SillyTavern-style) ==============
export const worldBooks = sqliteTable("world_books", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  createdBy: text("created_by").references(() => users.id),
  name: text("name").notNull(),
  description: text("description").default(""),
  scanDepth: integer("scan_depth").default(6000), // chars to scan for keyword activation
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const worldBookEntries = sqliteTable("world_book_entries", {
  id: text("id").primaryKey(),
  worldBookId: text("world_book_id").notNull().references(() => worldBooks.id),
  keys: text("keys").default("[]"), // JSON array of primary trigger keywords
  secondaryKeys: text("secondary_keys").default("[]"), // JSON array — AND / NOT logic
  selectiveLogic: text("selective_logic").default(null), // "AND" | "NOT" | null (= OR)
  content: text("content").notNull(),
  constant: integer("constant", { mode: "boolean" }).default(false), // always inject (蓝灯)
  caseSensitive: integer("case_sensitive", { mode: "boolean" }).default(false),
  insertionOrder: integer("insertion_order").default(0),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  priority: integer("priority").default(10),
  position: text("position").default("before_char"), // "before_char" | "after_char"
  tokenBudget: integer("token_budget").default(-1), // max tokens (-1 = no limit)
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ============== Roleplay Sessions ==============
export const roleplaySessions = sqliteTable("roleplay_sessions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: text("user_id").notNull().references(() => users.id),
  characterId: text("character_id").notNull().references(() => characterCards.id),
  channelId: text("channel_id").references(() => channels.id),
  history: text("history").default("[]"), // JSON array of {role, content}
  /** SillyTavern Author's Note — injected near the end of the chat for
   *  strong recent-context control ("全局指令微调"). Empty = disabled. */
  authorNote: text("author_note").default(""),
  /** 0..4 — how many most-recent turns the note trails behind (3 = default). */
  authorNoteDepth: integer("author_note_depth").default(3),
  /** Bond (affection) points — grows with each turn, gates relationship stages. */
  affection: integer("affection").default(0),
  /** ISO date (YYYY-MM-DD) of the last affection-gaining turn — daily bond bonus. */
  lastBondDay: text("last_bond_day"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ============== Frontend Error Telemetry ==============
export const appErrors = sqliteTable("app_errors", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").references(() => tenants.id),
  userId: text("user_id").references(() => users.id),
  type: text("type").notNull(), // "error" | "unhandledrejection" | "console"
  message: text("message").default(""),
  stack: text("stack"),
  url: text("url"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

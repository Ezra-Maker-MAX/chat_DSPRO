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
  isOnline: integer("is_online", { mode: "boolean" }).default(false),
  lastSeen: text("last_seen").default(sql`(datetime('now'))`),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("user_tenant_nickname").on(table.tenantId, table.nickname),
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

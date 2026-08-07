// Raw SQL DDL for tables (mirrors schema.ts).
// Executed by /api/init to create the database on a fresh Turso deployment.

export const INIT_SQL = [
  `CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    invite_code TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    max_members INTEGER DEFAULT 100,
    allow_media INTEGER DEFAULT 1,
    allow_voice INTEGER DEFAULT 1,
    allow_video INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    nickname TEXT NOT NULL,
    avatar_seed TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    is_online INTEGER DEFAULT 0,
    last_seen TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS user_tenant_nickname ON users(tenant_id, nickname)`,

  `CREATE TABLE IF NOT EXISTS invite_codes (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    code TEXT NOT NULL UNIQUE,
    created_by TEXT REFERENCES users(id),
    single_use INTEGER DEFAULT 0,
    used_count INTEGER DEFAULT 0,
    max_uses INTEGER,
    expires_at TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS invite_tenant_code ON invite_codes(tenant_id, code)`,

  `CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS channel_tenant_slug ON channels(tenant_id, slug)`,

  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    channel_id TEXT NOT NULL REFERENCES channels(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    content TEXT DEFAULT '',
    type TEXT DEFAULT 'text',
    edited_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    message_id TEXT REFERENCES messages(id),
    uploader_id TEXT NOT NULL REFERENCES users(id),
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    media_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    storage_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration REAL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS llm_providers (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    api_key TEXT NOT NULL,
    base_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS llm_tenant_model ON llm_providers(tenant_id, model)`,

  `CREATE TABLE IF NOT EXISTS llm_routes (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    provider_id TEXT NOT NULL REFERENCES llm_providers(id),
    condition TEXT DEFAULT '*',
    priority INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS mcp_plugins (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT DEFAULT '',
    mcp_endpoint TEXT NOT NULL,
    auth_type TEXT DEFAULT 'none',
    auth_config TEXT,
    icon TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Seed: default demo tenant
  `INSERT OR IGNORE INTO tenants (id, name, slug, invite_code, description, max_members, allow_media, allow_voice, allow_video)
   VALUES ('tnt_demo0000000001', 'Demo Space', 'demo-space', 'DEMO-CODE-1234',
           'Welcome to Chatmosphere. Use this space to test the chat, media, and games.',
           100, 1, 1, 1)`,

  // Seed: default general channel
  `INSERT OR IGNORE INTO channels (id, tenant_id, name, slug, description, is_default)
   VALUES ('chn_demo00000001', 'tnt_demo0000000001', 'general', 'general', 'General discussion', 1)`,
];

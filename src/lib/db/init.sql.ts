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
    username TEXT,
    password_hash TEXT,
    is_online INTEGER DEFAULT 0,
    last_seen TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  // Add account columns to existing deployments FIRST so indexes below can reference them.
  // Idempotent: on fresh DBs the columns already exist, so these are skipped as "duplicate column name".
  `ALTER TABLE users ADD COLUMN username TEXT`,
  `ALTER TABLE users ADD COLUMN password_hash TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS user_tenant_nickname ON users(tenant_id, nickname)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS user_tenant_username ON users(tenant_id, username)`,

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
    reply_to_id TEXT,
    target_user_id TEXT,
    edited_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  // Idempotent ALTERs for existing deployments.
  `ALTER TABLE messages ADD COLUMN reply_to_id TEXT`,
  `ALTER TABLE messages ADD COLUMN target_user_id TEXT`,

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

  `CREATE TABLE IF NOT EXISTS tenant_balances (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    balance_cents INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tb_tenant ON tenant_balances(tenant_id)`,

  `CREATE TABLE IF NOT EXISTS recharge_orders (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'CNY',
    status TEXT DEFAULT 'pending',
    deepseek_before TEXT,
    deepseek_after TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    confirmed_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS tenant_pricing (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    provider TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'default',
    input_cents_per_1m INTEGER DEFAULT 0,
    output_cents_per_1m INTEGER DEFAULT 0,
    image_cents_per_unit INTEGER DEFAULT 0
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tp_tenant_provider_model ON tenant_pricing(tenant_id, provider, model)`,

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

  `CREATE TABLE IF NOT EXISTS bot_profiles (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL DEFAULT 'Chatmosphere Bot',
    avatar_seed TEXT NOT NULL DEFAULT 'bot',
    system_prompt TEXT DEFAULT 'You are a helpful assistant inside an anonymous chat space. You read the conversation and reply naturally. Keep replies concise.',
    roleplay_system_prompt TEXT DEFAULT '',
    is_enabled INTEGER DEFAULT 1,
    image_provider TEXT,
    image_model TEXT,
    image_api_key TEXT,
    image_base_url TEXT,
    image_cooldown_ms INTEGER DEFAULT 180000,
    last_image_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `ALTER TABLE bot_profiles ADD COLUMN roleplay_system_prompt TEXT DEFAULT ''`,
  `CREATE UNIQUE INDEX IF NOT EXISTS bot_tenant_unique ON bot_profiles(tenant_id)`,

  `CREATE TABLE IF NOT EXISTS bot_image_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    channel_id TEXT NOT NULL REFERENCES channels(id),
    requested_by TEXT NOT NULL REFERENCES users(id),
    prompt TEXT NOT NULL,
    status TEXT DEFAULT 'queued',
    image_url TEXT,
    error TEXT,
    position INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS world_books (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    created_by TEXT REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    scan_depth INTEGER DEFAULT 6000,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  // Migration: add lorebook v2 columns to existing deployments.
  // Idempotent — duplicate column name is tolerated by /api/admin/init.
  `ALTER TABLE world_books ADD COLUMN scan_depth INTEGER DEFAULT 6000`,

  `CREATE TABLE IF NOT EXISTS world_book_entries (
    id TEXT PRIMARY KEY NOT NULL,
    world_book_id TEXT NOT NULL REFERENCES world_books(id),
    keys TEXT DEFAULT '[]',
    secondary_keys TEXT DEFAULT '[]',
    selective_logic TEXT DEFAULT NULL,
    content TEXT NOT NULL,
    constant INTEGER DEFAULT 0,
    case_sensitive INTEGER DEFAULT 0,
    insertion_order INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 10,
    position TEXT DEFAULT 'before_char',
    token_budget INTEGER DEFAULT -1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  // Migration: add lorebook v2 columns to existing deployments.
  `ALTER TABLE world_book_entries ADD COLUMN secondary_keys TEXT DEFAULT '[]'`,
  `ALTER TABLE world_book_entries ADD COLUMN selective_logic TEXT DEFAULT NULL`,
  `ALTER TABLE world_book_entries ADD COLUMN constant INTEGER DEFAULT 0`,
  `ALTER TABLE world_book_entries ADD COLUMN case_sensitive INTEGER DEFAULT 0`,
  `ALTER TABLE world_book_entries ADD COLUMN token_budget INTEGER DEFAULT -1`,

  `CREATE TABLE IF NOT EXISTS character_cards (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    created_by TEXT REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    personality TEXT DEFAULT '',
    scenario TEXT DEFAULT '',
    first_mes TEXT DEFAULT '',
    mes_example TEXT DEFAULT '',
    system_prompt TEXT DEFAULT '',
    post_history_instructions TEXT DEFAULT '',
    avatar_seed TEXT DEFAULT 'char',
    avatar_url TEXT,
    emotes TEXT DEFAULT '[]',
    world_book_id TEXT REFERENCES world_books(id),
    visibility TEXT DEFAULT 'public',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `ALTER TABLE character_cards ADD COLUMN avatar_url TEXT`,
  `ALTER TABLE character_cards ADD COLUMN emotes TEXT DEFAULT '[]'`,
  `ALTER TABLE character_cards ADD COLUMN visibility TEXT DEFAULT 'public'`,

  `CREATE TABLE IF NOT EXISTS roleplay_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    character_id TEXT NOT NULL REFERENCES character_cards(id),
    channel_id TEXT REFERENCES channels(id),
    history TEXT DEFAULT '[]',
    author_note TEXT DEFAULT '',
    author_note_depth INTEGER DEFAULT 3,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `ALTER TABLE roleplay_sessions ADD COLUMN author_note TEXT DEFAULT ''`,
  `ALTER TABLE roleplay_sessions ADD COLUMN author_note_depth INTEGER DEFAULT 3`,

  // Seed: default demo tenant
  `INSERT OR IGNORE INTO tenants (id, name, slug, invite_code, description, max_members, allow_media, allow_voice, allow_video)
   VALUES ('tnt_demo0000000001', 'Demo Space', 'demo-space', 'DEMO-CODE-1234',
           'Welcome to Chatmosphere. Use this space to test the chat, media, and games.',
           100, 1, 1, 1)`,

  // Seed: default general channel
  `INSERT OR IGNORE INTO channels (id, tenant_id, name, slug, description, is_default)
   VALUES ('chn_demo00000001', 'tnt_demo0000000001', 'general', 'general', 'General discussion', 1)`,
];

# Chatmosphere

Multi-tenant anonymous chat rooms with media sharing, game plaza, and multi-model AI gateway.

Built for **[Vercel](https://vercel.com)** + **[Turso](https://turso.tech)**.

## Architecture

```
chatmosphere/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Landing page
│   │   ├── join/page.tsx       # Invite code entry
│   │   ├── [tenant]/           # Tenant routes (protected)
│   │   │   ├── layout.tsx      # Sidebar + particle bg
│   │   │   ├── page.tsx        # Redirect to default channel
│   │   │   ├── channels/[id]/  # Chat interface
│   │   │   ├── games/          # MCP plugin marketplace
│   │   │   └── settings/       # LLM provider management
│   │   └── api/                # API routes
│   │       ├── auth/           # Join, logout
│   │       ├── chat/           # Messages CRUD + SSE
│   │       ├── upload/         # Vercel Blob media uploads
│   │       ├── llm/            # Providers, routing, chat proxy
│   │       ├── mcp/            # Plugin install, execute
│   │       └── tenants/        # Tenant info
│   ├── components/
│   │   ├── auth/               # Landing, join form
│   │   ├── chat/               # ChatArea, MessageBubble, Input
│   │   ├── layout/             # Sidebar, ParticleBackground
│   │   └── games/              # Game plaza
│   ├── lib/
│   │   ├── db/                 # Turso + Drizzle ORM
│   │   ├── auth.ts             # JWT session management
│   │   ├── upload.ts           # Vercel Blob uploads
│   │   ├── llm-gateway.ts      # Multi-model routing
│   │   └── mcp-registry.ts     # MCP plugin registry
│   └── hooks/                  # React hooks
└── drizzle/                    # DB migrations
```

## Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| Framework | Next.js 15 App Router | Vercel-native, SSR/SSG, Server Actions |
| Database | Turso (libsql) | SQLite-compatible, edge-distributed, HTTP |
| ORM | Drizzle | Type-safe, lightweight, Turso-first |
| Realtime | SSE (Server-Sent Events) | Free, works on Vercel serverless |
| Storage | Vercel Blob | Media uploads, global CDN |
| AI | Vercel AI SDK | Unifies OpenAI/Anthropic/DeepSeek/Google |
| Auth | JWT (jose) | Cookie-based, no external service |
| UI | Tailwind CSS 4 + shadcn/ui | Design system, accessible |
| Icons | Lucide React | Consistent icon set |

## Features

### Chat
- Multi-channel per tenant
- Text messages (hyperlinks stripped)
- Image, voice, video uploads
- Real-time via SSE
- Anonymous nicknames + deterministic avatars

### Game Plaza
- MCP plugin marketplace
- Categories: Games, Utilities, AI, Social
- Install/uninstall per tenant
- Sandboxed plugin execution

### LLM Gateway
- Multi-provider: OpenAI, Anthropic, DeepSeek, Google
- Per-tenant provider configuration
- Routing rules with priority + prompt regex
- API key encryption at rest

## Getting Started

### Prerequisites

1. [Turso](https://turso.tech) account + database
2. [Vercel](https://vercel.com) account (for deployment)
3. [Vercel Blob](https://vercel.com/storage/blob) (for media uploads)

### Local Development

```bash
# 1. Clone
git clone <repo> && cd chatmosphere

# 2. Install
npm install

# 3. Environment
cp .env.local.example .env.local
# Fill in TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET, BLOB_READ_WRITE_TOKEN

# 4. Push schema to Turso
npm run db:push

# 5. Seed demo data
npx tsx src/lib/db/seed.ts

# 6. Start
npm run dev
```

Open http://localhost:3000 and use invite code: **DEMO-CODE-1234**

### Deploy to Vercel

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel

# 3. Set environment variables in Vercel dashboard:
#    TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET, BLOB_READ_WRITE_TOKEN

# 4. Push DB schema after deploy
vercel env pull
npm run db:push
```

### Create a New Tenant

Use the seed script as reference, or insert directly:

```sql
INSERT INTO tenants (id, name, slug, invite_code, description)
VALUES ('tnt_xxx', 'My Space', 'my-space', 'MYCODE-1234-5678', 'Custom space');
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TURSO_DATABASE_URL` | Yes | Turso database URL |
| `TURSO_AUTH_TOKEN` | Yes | Turso auth token |
| `JWT_SECRET` | Yes | Secret for signing session tokens |
| `BLOB_READ_WRITE_TOKEN` | For media | Vercel Blob token |
| `OPENAI_API_KEY` | Optional | Default OpenAI provider |
| `ANTHROPIC_API_KEY` | Optional | Default Anthropic provider |
| `DEEPSEEK_API_KEY` | Optional | Default DeepSeek provider |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Optional | Default Google provider |

## License

MIT

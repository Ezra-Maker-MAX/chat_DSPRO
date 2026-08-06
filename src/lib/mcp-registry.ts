import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export interface McpPluginInfo {
  id: string;
  name: string;
  category: "game" | "utility" | "ai" | "social";
  description: string;
  endpoint: string;
  icon: string;
}

// Built-in plugin marketplace
export const BUILTIN_PLUGINS: Record<string, McpPluginInfo> = {
  "mcp-chess": {
    id: "mcp-chess",
    name: "Chess Arena",
    category: "game",
    description: "Play chess against AI or other members. Supports standard chess rules with ELO ranking.",
    endpoint: "", // user configurable
    icon: "♟",
  },
  "mcp-trivia": {
    id: "mcp-trivia",
    name: "Trivia Battle",
    category: "game",
    description: "Real-time trivia quiz with categories. Compete for high scores.",
    endpoint: "",
    icon: "🧠",
  },
  "mcp-poker": {
    id: "mcp-poker",
    name: "Poker Room",
    category: "game",
    description: "Texas Hold'em poker with AI dealers. Play with friends.",
    endpoint: "",
    icon: "🃏",
  },
  "mcp-wordle": {
    id: "mcp-wordle",
    name: "Wordle Multi",
    category: "game",
    description: "Daily wordle challenge with multiplayer leaderboard.",
    endpoint: "",
    icon: "🔤",
  },
  "mcp-draw": {
    id: "mcp-draw",
    name: "Sketch & Guess",
    category: "game",
    description: "Draw prompts and let others guess. Pictionary-style fun.",
    endpoint: "",
    icon: "🎨",
  },
  "mcp-calc": {
    id: "mcp-calc",
    name: "Super Calculator",
    category: "utility",
    description: "Advanced mathematical computation engine with graphing.",
    endpoint: "",
    icon: "🔢",
  },
  "mcp-translate": {
    id: "mcp-translate",
    name: "Live Translate",
    category: "utility",
    description: "Real-time message translation supporting 50+ languages.",
    endpoint: "",
    icon: "🌐",
  },
  "mcp-weather": {
    id: "mcp-weather",
    name: "Weather Station",
    category: "utility",
    description: "Global weather forecasts and interactive maps.",
    endpoint: "",
    icon: "🌤",
  },
};

export async function installPlugin(tenantId: string, pluginId: string, endpoint: string): Promise<boolean> {
  const info = BUILTIN_PLUGINS[pluginId];
  if (!info) return false;

  // Check if already installed
  const existing = await db
    .select()
    .from(schema.mcpPlugins)
    .where(
      and(
        eq(schema.mcpPlugins.tenantId, tenantId),
        eq(schema.mcpPlugins.name, info.name)
      )
    )
    .limit(1);

  if (existing.length > 0) return true; // already installed

  await db.insert(schema.mcpPlugins).values({
    id: `${pluginId}_${tenantId}`,
    tenantId,
    name: info.name,
    category: info.category,
    description: info.description,
    mcpEndpoint: endpoint || info.endpoint,
    icon: info.icon,
  });

  return true;
}

export async function getTenantPlugins(tenantId: string) {
  return db
    .select()
    .from(schema.mcpPlugins)
    .where(eq(schema.mcpPlugins.tenantId, tenantId));
}

export async function uninstallPlugin(tenantId: string, pluginId: string) {
  await db
    .delete(schema.mcpPlugins)
    .where(
      and(
        eq(schema.mcpPlugins.tenantId, tenantId),
        eq(schema.mcpPlugins.id, pluginId)
      )
    );
}

export async function callMcpPlugin(
  endpoint: string,
  tool: string,
  args: Record<string, unknown>
) {
  try {
    const response = await fetch(`${endpoint}/tools/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tool, arguments: args }),
    });
    return await response.json();
  } catch (error) {
    return { error: "Failed to call MCP plugin", details: String(error) };
  }
}

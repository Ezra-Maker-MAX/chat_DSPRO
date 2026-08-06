import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { callMcpPlugin } from "@/lib/mcp-registry";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { pluginId, tool, args } = body;

  if (!pluginId || !tool) {
    return NextResponse.json({ error: "pluginId and tool required" }, { status: 400 });
  }

  // Verify plugin is installed for this tenant
  const [plugin] = await db
    .select()
    .from(schema.mcpPlugins)
    .where(
      and(
        eq(schema.mcpPlugins.tenantId, session.tenantId),
        eq(schema.mcpPlugins.id, pluginId)
      )
    )
    .limit(1);

  if (!plugin) {
    return NextResponse.json({ error: "Plugin not installed" }, { status: 404 });
  }

  if (!plugin.mcpEndpoint) {
    return NextResponse.json({ error: "Plugin endpoint not configured" }, { status: 400 });
  }

  const result = await callMcpPlugin(plugin.mcpEndpoint, tool, args || {});
  return NextResponse.json(result);
}

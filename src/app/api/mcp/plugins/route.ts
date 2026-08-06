import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { installPlugin, uninstallPlugin, getTenantPlugins, BUILTIN_PLUGINS } from "@/lib/mcp-registry";

// GET: list marketplace + installed plugins
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const installed = await getTenantPlugins(session.tenantId);

  return NextResponse.json({
    marketplace: Object.values(BUILTIN_PLUGINS),
    installed: installed.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      icon: p.icon,
      isActive: p.isActive,
    })),
  });
}

// POST: install a plugin
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { pluginId, endpoint } = body;

  if (!pluginId) {
    return NextResponse.json({ error: "pluginId required" }, { status: 400 });
  }

  const success = await installPlugin(session.tenantId, pluginId, endpoint || "");
  if (!success) {
    return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// DELETE: uninstall a plugin
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pluginId = searchParams.get("id");

  if (!pluginId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await uninstallPlugin(session.tenantId, pluginId);
  return NextResponse.json({ success: true });
}

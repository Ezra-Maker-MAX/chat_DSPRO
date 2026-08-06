import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function TenantPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  // Auth
  const cookieStore = await cookies();
  const token = cookieStore.get("ch_session")?.value;
  if (!token) redirect("/join");

  const payload = await verifyToken(token);
  if (!payload) redirect("/join");

  // Find first/default channel
  const channels = await db
    .select()
    .from(schema.channels)
    .where(eq(schema.channels.tenantId, payload.tenantId));

  if (channels.length === 0) {
    // No channels exist — create default
    const channelId = `chn_${Date.now().toString(36)}`;
    await db.insert(schema.channels).values({
      id: channelId,
      tenantId: payload.tenantId,
      name: "general",
      slug: "general",
      description: "General discussion",
      isDefault: true,
    });
    redirect(`/${slug}/channels/${channelId}`);
  }

  const defaultChannel = channels.find((c) => c.isDefault) || channels[0];
  redirect(`/${slug}/channels/${defaultChannel.id}`);
}

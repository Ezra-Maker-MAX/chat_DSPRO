import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import ChatPageClient from "./ChatPageClient";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ tenant: string; channelId: string }>;
}) {
  const { channelId } = await params;

  // Auth
  const cookieStore = await cookies();
  const token = cookieStore.get("ch_session")?.value;
  if (!token) redirect("/join");

  const payload = await verifyToken(token);
  if (!payload) redirect("/join");

  // Get channel
  const [channel] = await db
    .select()
    .from(schema.channels)
    .where(
      and(
        eq(schema.channels.id, channelId),
        eq(schema.channels.tenantId, payload.tenantId)
      )
    )
    .limit(1);

  if (!channel) redirect(`/${payload.tenantId}`);

  // Get tenant
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, payload.tenantId))
    .limit(1);

  return (
    <ChatPageClient
      channelId={channel.id}
      channelName={channel.name}
      currentUserId={payload.userId}
      allowMedia={tenant?.allowMedia ?? true}
      allowVoice={tenant?.allowVoice ?? true}
    />
  );
}

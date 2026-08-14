import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import TenantLayoutClient from "@/components/layout/TenantLayoutClient";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  // Auth
  const cookieStore = await cookies();
  const token = cookieStore.get("ch_session")?.value;
  if (!token) redirect("/join");

  const payload = await verifyToken(token);
  if (!payload) redirect("/join");

  // Verify tenant matches
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, slug))
    .limit(1);

  if (!tenant || tenant.id !== payload.tenantId) {
    redirect("/join");
  }

  // Get channels
  const channels = await db
    .select()
    .from(schema.channels)
    .where(eq(schema.channels.tenantId, tenant.id));

  // Get online count + current user's 18+ grant (server-side, no extra roundtrip)
  const users = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.tenantId, tenant.id));
  const onlineCount = users.filter((u) => u.isOnline).length;
  const me = users.find((u) => u.id === payload.userId);
  const adultEnabled = payload.role === "admin" ? true : !!me?.adultEnabled;

  return (
    <TenantLayoutClient
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      channels={channels}
      onlineCount={onlineCount}
      userId={payload.userId}
      nickname={payload.nickname}
      avatarSeed={me?.avatarSeed || ""}
      userRole={payload.role}
      adultEnabled={adultEnabled}
      allowMedia={tenant.allowMedia}
      allowVoice={tenant.allowVoice}
      allowVideo={tenant.allowVideo}
    >
      {children}
    </TenantLayoutClient>
  );
}

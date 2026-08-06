import Link from "next/link";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import LandingClient from "@/components/auth/LandingClient";

async function getExistingSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("ch_session")?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    if (!payload) return null;

    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, payload.tenantId))
      .limit(1);

    if (!tenant) return null;

    const [channel] = await db
      .select()
      .from(schema.channels)
      .where(eq(schema.channels.tenantId, tenant.id))
      .limit(1);

    return {
      tenantSlug: tenant.slug,
      channelId: channel?.id || null,
      tenantName: tenant.name,
    };
  } catch {
    return null;
  }
}

export default async function LandingPage() {
  const session = await getExistingSession();

  return <LandingClient session={session} />;
}

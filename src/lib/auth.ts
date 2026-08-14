import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generateId } from "./utils";
import { resolveInvite, consumeInvite } from "./invites";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "chatmosphere-dev-secret-change-in-production-32chars"
);

const COOKIE_NAME = "ch_session";
const TOKEN_EXPIRY = "7d";

export interface SessionPayload {
  userId: string;
  tenantId: string;
  nickname: string;
  role: string;
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function joinTenant(
  inviteCode: string,
  nickname: string
): Promise<{ token: string; tenant: typeof schema.tenants.$inferSelect } | { error: string }> {
  // Resolve the invite code → tenant (supports both generated codes and the legacy column)
  const resolved = await resolveInvite(inviteCode);
  if ("error" in resolved) {
    return { error: resolved.error };
  }
  const { tenant, invite } = resolved;

  // Check member count
  const members = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.tenantId, tenant.id));

  if (members.length >= (tenant.maxMembers ?? 100)) {
    return { error: "This space is full" };
  }

  // Check nickname uniqueness
  const existing = members.find((u) => u.nickname === nickname);
  if (existing) {
    return { error: "Nickname already taken in this space" };
  }

  // Create user
  const userId = `usr_${generateId(16)}`;
  const avatarSeed = generateId(8);

  await db.insert(schema.users).values({
    id: userId,
    tenantId: tenant.id,
    nickname,
    avatarSeed,
    tokenHash: "", // will be updated after token creation
    role: members.length === 0 ? "admin" : "member",
  });

  // Sign token
  const token = await signToken({
    userId,
    tenantId: tenant.id,
    nickname,
    role: members.length === 0 ? "admin" : "member",
  });

  // Update token hash
  await db
    .update(schema.users)
    .set({ tokenHash: await hashToken(token) })
    .where(eq(schema.users.id, userId));

  // Consume / burn the invite (single-use or count-limited)
  if (invite?.id) {
    await consumeInvite(invite);
  }

  return { token, tenant };
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

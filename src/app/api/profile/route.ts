import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export interface ProfileField {
  k: string;
  v: string;
}
export interface UserProfile {
  avatarUrl: string | null;
  fields: ProfileField[];
}

const KINDS = ["sfw", "nsfw"] as const;
type Kind = (typeof KINDS)[number];

const EMPTY_PROFILE: UserProfile = { avatarUrl: null, fields: [] };

/** Parse the JSON profile column safely — bad/null values fall back to empty. */
export function parseProfile(raw: string | null): UserProfile {
  if (!raw) return EMPTY_PROFILE;
  try {
    const p = JSON.parse(raw);
    const fields = Array.isArray(p?.fields)
      ? p.fields
          .filter((f: unknown) => f && typeof f === "object" && typeof (f as ProfileField).k === "string" && typeof (f as ProfileField).v === "string")
          .slice(0, 30)
          .map((f: ProfileField) => ({ k: f.k.slice(0, 40), v: f.v.slice(0, 500) }))
      : [];
    return {
      avatarUrl: typeof p?.avatarUrl === "string" && p.avatarUrl.trim() ? p.avatarUrl.slice(0, 500) : null,
      fields,
    };
  } catch {
    return EMPTY_PROFILE;
  }
}

function profileColumn(kind: Kind) {
  return kind === "nsfw" ? schema.users.profileNsfw : schema.users.profileSfw;
}

/**
 * GET /api/profile
 *  ?kind=sfw|nsfw          own profile (default sfw)
 *  ?userId=X&kind=sfw      other user's SFW profile (any logged-in member)
 *  ?userId=X&kind=nsfw     other user's NSFW profile — requires adult access
 *  ?kind=nsfw&all=1        every adult-enabled member's NSFW profile (18+ zone roster)
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const kindParam = sp.get("kind") || "sfw";
  const kind: Kind = kindParam === "nsfw" ? "nsfw" : "sfw";
  const all = sp.get("all") === "1";
  const targetId = sp.get("userId");

  // 18+ roster — only for users who can see the adult zone.
  if (all) {
    if (kind !== "nsfw") {
      return NextResponse.json({ error: "all=1 is only supported for nsfw" }, { status: 400 });
    }
    const [me] = await db
      .select({ role: schema.users.role, adultEnabled: schema.users.adultEnabled })
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1);
    if (!me || (me.role !== "admin" && !me.adultEnabled)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const users = await db
      .select({
        id: schema.users.id,
        nickname: schema.users.nickname,
        avatarSeed: schema.users.avatarSeed,
        profile: schema.users.profileNsfw,
      })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.tenantId, session.tenantId),
          eq(schema.users.adultEnabled, true)
        )
      );
    return NextResponse.json({
      members: users.map((u) => ({
        id: u.id,
        nickname: u.nickname,
        avatarSeed: u.avatarSeed,
        isMe: u.id === session.userId,
        profile: parseProfile(u.profile),
      })),
    });
  }

  // Reading a specific user (defaults to self).
  const isSelf = !targetId || targetId === session.userId;
  const [user] = await db
    .select({
      id: schema.users.id,
      nickname: schema.users.nickname,
      avatarSeed: schema.users.avatarSeed,
      role: schema.users.role,
      adultEnabled: schema.users.adultEnabled,
      profile: profileColumn(kind),
    })
    .from(schema.users)
    .where(eq(schema.users.id, isSelf ? session.userId : targetId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Reading someone else's NSFW profile requires adult access.
  if (!isSelf && kind === "nsfw") {
    const [me] = await db
      .select({ adultEnabled: schema.users.adultEnabled })
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1);
    if (!me || (session.role !== "admin" && !me.adultEnabled)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  return NextResponse.json({
    user: {
      id: user.id,
      nickname: user.nickname,
      avatarSeed: user.avatarSeed,
      isMe: isSelf,
      profile: parseProfile(user.profile),
    },
  });
}

/**
 * PUT /api/profile — save your own profile.
 * body: { kind: "sfw"|"nsfw", avatarUrl?: string|null, fields?: {k,v}[] }
 */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { kind?: string; avatarUrl?: unknown; fields?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let kind: Kind;
  if (body.kind === "nsfw") kind = "nsfw";
  else if (body.kind === "sfw") kind = "sfw";
  else {
    return NextResponse.json({ error: "kind must be sfw or nsfw" }, { status: 400 });
  }

  // avatarUrl: string ≤500, or null/undefined (keep as null).
  let avatarUrl: string | null = null;
  if (typeof body.avatarUrl === "string" && body.avatarUrl.trim()) {
    avatarUrl = body.avatarUrl.trim().slice(0, 500);
  }

  // fields: [{k,v}] ≤30 rows, trimmed, empties dropped.
  const fields: ProfileField[] = Array.isArray(body.fields)
    ? body.fields
        .filter(
          (f: unknown) =>
            f && typeof f === "object" &&
            typeof (f as ProfileField).k === "string" &&
            typeof (f as ProfileField).v === "string"
        )
        .map((f: ProfileField) => ({
          k: f.k.trim().slice(0, 40),
          v: f.v.trim().slice(0, 500),
        }))
        .filter((f) => f.k || f.v)
        .slice(0, 30)
    : [];

  const profile: UserProfile = { avatarUrl, fields };
  await db
    .update(schema.users)
    .set({ [kind === "nsfw" ? "profileNsfw" : "profileSfw"]: JSON.stringify(profile) })
    .where(eq(schema.users.id, session.userId));

  return NextResponse.json({ ok: true, profile });
}

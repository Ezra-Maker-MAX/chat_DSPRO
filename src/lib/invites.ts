import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generateInviteCode, generateId } from "./utils";

/**
 * Generate a new invite code for a tenant (admin only).
 * Codes live in the `invite_codes` table, supporting single-use / multi-use / expiry.
 */
export async function createInviteCode(params: {
  tenantId: string;
  createdBy?: string;
  singleUse?: boolean;
  maxUses?: number;
  expiresInHours?: number; // undefined = never expires
}): Promise<{ id: string; code: string; expiresAt: string | null }> {
  const { tenantId, createdBy, singleUse, maxUses, expiresInHours } = params;

  // Generate a code that doesn't collide with existing ones (retry a few times)
  let code = generateInviteCode();
  let collision = true;
  let attempts = 0;
  while (collision && attempts < 5) {
    const existing = await db
      .select({ id: schema.inviteCodes.id })
      .from(schema.inviteCodes)
      .where(eq(schema.inviteCodes.code, code))
      .limit(1);
    if (existing.length === 0) {
      collision = false;
    } else {
      code = generateInviteCode();
      attempts++;
    }
  }

  const expiresAt =
    typeof expiresInHours === "number"
      ? new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()
      : null;

  const id = `inv_${generateId(16)}`;
  await db.insert(schema.inviteCodes).values({
    id,
    tenantId,
    code,
    createdBy: createdBy || null,
    singleUse: singleUse ?? false,
    maxUses: maxUses ?? null,
    expiresAt,
    usedCount: 0,
    isActive: true,
  });

  return { id, code, expiresAt };
}

/**
 * Resolve an invite code to its tenant, validating active/expiry/use limits.
 * Returns the tenant row + the invite row on success.
 */
export async function resolveInvite(
  code: string
): Promise<
  | { tenant: typeof schema.tenants.$inferSelect; invite: typeof schema.inviteCodes.$inferSelect }
  | { error: string }
> {
  const normalized = code.toUpperCase().replace(/\s/g, "");

  // 1. Look up the code in the invite_codes table (primary path for generated codes)
  const invite = await db
    .select()
    .from(schema.inviteCodes)
    .where(eq(schema.inviteCodes.code, normalized))
    .limit(1);

  // 2. Fall back to the legacy tenant.invite_code column (e.g. the seeded DEMO code)
  let tenantId: string | undefined = invite[0]?.tenantId;
  let inviteRow = invite[0];

  if (!inviteRow) {
    const legacyTenant = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.inviteCode, normalized))
      .limit(1);
    if (legacyTenant[0]) {
      tenantId = legacyTenant[0].id;
    }
  }

  if (!tenantId) {
    return { error: "Invalid invite code" };
  }

  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);
  if (!tenant) {
    return { error: "Space not found" };
  }

  // Validate invite state (only when it's a real invite row; legacy tenant code is always valid)
  if (inviteRow) {
    if (!inviteRow.isActive) {
      return { error: "This invite code has been disabled" };
    }
    if (inviteRow.expiresAt && new Date(inviteRow.expiresAt).getTime() < Date.now()) {
      return { error: "This invite code has expired" };
    }
    if (inviteRow.maxUses !== null && inviteRow.usedCount >= inviteRow.maxUses) {
      return { error: "This invite code has reached its usage limit" };
    }
  }

  return { tenant, invite: inviteRow ?? (null as unknown as typeof schema.inviteCodes.$inferSelect) };
}

/**
 * Mark an invite code as used (burns single-use codes, increments counters).
 */
export async function consumeInvite(invite: {
  id?: string;
  singleUse?: boolean;
  usedCount?: number;
  maxUses?: number | null;
}): Promise<void> {
  if (!invite.id) return;
  const next = (invite.usedCount ?? 0) + 1;
  const deactivate = invite.singleUse || (invite.maxUses !== null && next >= (invite.maxUses ?? 0));
  await db
    .update(schema.inviteCodes)
    .set({
      usedCount: next,
      isActive: deactivate ? false : true,
    })
    .where(eq(schema.inviteCodes.id, invite.id));
}

/**
 * Create a brand new independent space (tenant) with its own admin and invite code.
 * Returns the new tenant slug + code so the creator can be redirected in.
 */
export async function createTenant(params: {
  name: string;
  description?: string;
  createdByUserId: string;
  createdByNickname: string;
  maxMembers?: number;
}): Promise<
  | { tenantId: string; slug: string; code: string; name: string }
  | { error: string }
> {
  const name = params.name.trim();
  if (name.length < 2 || name.length > 40) {
    return { error: "Space name must be 2-40 characters" };
  }

  // Build a unique slug from the name
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "space";

  let slug = baseSlug;
  let slugTaken = true;
  let attempts = 0;
  while (slugTaken && attempts < 8) {
    const existing = await db
      .select({ id: schema.tenants.id })
      .from(schema.tenants)
      .where(eq(schema.tenants.slug, slug))
      .limit(1);
    if (existing.length === 0) {
      slugTaken = false;
    } else {
      slug = `${baseSlug}-${generateId(4)}`;
      attempts++;
    }
  }

  const tenantId = `tnt_${generateId(16)}`;
  const adminId = `usr_${generateId(16)}`;
  const avatarSeed = generateId(8);

  // Insert tenant (invite_code column holds the primary entry code for backward compat)
  await db.insert(schema.tenants).values({
    id: tenantId,
    name,
    slug,
    inviteCode: generateInviteCode(),
    description: params.description || "",
    maxMembers: params.maxMembers ?? 100,
    allowMedia: true,
    allowVoice: true,
    allowVideo: true,
  });

  // Insert the admin user
  await db.insert(schema.users).values({
    id: adminId,
    tenantId,
    nickname: params.createdByNickname,
    avatarSeed,
    tokenHash: "",
    role: "admin",
    isOnline: true,
  });

  // Insert a general channel
  await db.insert(schema.channels).values({
    id: `chn_${generateId(16)}`,
    tenantId,
    name: "general",
    slug: "general",
    description: "General discussion",
    isDefault: true,
  });

  // Insert an invite code row for this tenant
  const code = generateInviteCode();
  await db.insert(schema.inviteCodes).values({
    id: `inv_${generateId(16)}`,
    tenantId,
    code,
    createdBy: adminId,
    singleUse: false,
    maxUses: null,
    expiresAt: null,
    usedCount: 0,
    isActive: true,
  });

  // Keep tenant.invite_code in sync so legacy lookup also works
  await db
    .update(schema.tenants)
    .set({ inviteCode: code })
    .where(eq(schema.tenants.id, tenantId));

  return { tenantId, slug, code, name };
}

/**
 * Database seed script.
 * Run with: npx tsx src/lib/db/seed.ts
 *
 * Creates a demo tenant with:
 * - Invite code: DEMO-CODE-1234
 * - Default channel: general
 */

import { db, schema } from "./index";
import { generateId } from "../utils";

async function seed() {
  console.log("Seeding database...");

  const tenantId = `tnt_${generateId(12)}`;
  const channelId = `chn_${generateId(12)}`;

  // Create tenant
  try {
    await db.insert(schema.tenants).values({
      id: tenantId,
      name: "Demo Space",
      slug: "demo-space",
      inviteCode: "DEMO-CODE-1234",
      description: "A demo space to test Chatmosphere",
      maxMembers: 100,
      allowMedia: true,
      allowVoice: true,
      allowVideo: true,
    });
    console.log(`✓ Tenant created: demo-space (invite: DEMO-CODE-1234)`);
  } catch (e: any) {
    if (e.message?.includes("UNIQUE")) {
      console.log("⚠ Tenant already exists, skipping.");
    } else {
      throw e;
    }
  }

  // Create default channel
  try {
    await db.insert(schema.channels).values({
      id: channelId,
      tenantId,
      name: "general",
      slug: "general",
      description: "General discussion",
      isDefault: true,
    });
    console.log("✓ Default channel created: #general");
  } catch (e: any) {
    if (e.message?.includes("UNIQUE")) {
      console.log("⚠ Channel already exists, skipping.");
    } else {
      throw e;
    }
  }

  console.log("\nSeed complete! Use invite code: DEMO-CODE-1234");
  console.log("Start the app: npm run dev");
}

seed().catch(console.error);

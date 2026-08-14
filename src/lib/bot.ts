import { db, schema } from "@/lib/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { put } from "@vercel/blob";
import { broadcastToChannel } from "@/lib/sse";
import { chargeImage } from "./pricing";

// ============================================================
// Bot core service: profile, message reading, image queue, post
// ============================================================

const BOT_USER_ID_PREFIX = "bot_";

/** Get or create the bot profile row for a tenant. */
export async function ensureBotProfile(tenantId: string) {
  const [existing] = await db
    .select()
    .from(schema.botProfiles)
    .where(eq(schema.botProfiles.tenantId, tenantId))
    .limit(1);

  if (existing) return existing;

  const id = `bprof_${generateId(16)}`;
  await db.insert(schema.botProfiles).values({ id, tenantId });

  const [created] = await db
    .select()
    .from(schema.botProfiles)
    .where(eq(schema.botProfiles.id, id))
    .limit(1);
  return created;
}

/** Get (create if needed) the bot's synthetic user row so messages can be posted. */
export async function ensureBotUser(tenantId: string): Promise<{ userId: string; nickname: string; avatarSeed: string }> {
  const profile = await ensureBotProfile(tenantId);

  const [botUser] = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.tenantId, tenantId),
        eq(schema.users.role, "bot")
      )
    )
    .limit(1);

  if (botUser) {
    return { userId: botUser.id, nickname: botUser.nickname, avatarSeed: botUser.avatarSeed };
  }

  const nickname = profile.name.slice(0, 30) || "Bot";
  const userId = `${BOT_USER_ID_PREFIX}${generateId(16)}`;
  await db.insert(schema.users).values({
    id: userId,
    tenantId,
    nickname,
    avatarSeed: `bot_${generateId(8)}`,
    tokenHash: "", // bots have no session token
    role: "bot",
  });
  return { userId, nickname, avatarSeed: `bot_${generateId(8)}` };
}

/** Read the last N messages of a channel as conversational context for the bot. */
export async function readChannelContext(
  channelId: string,
  limit = 20
): Promise<{ role: "user" | "assistant"; content: string; nickname: string }[]> {
  const rows = await db
    .select({
      content: schema.messages.content,
      type: schema.messages.type,
      nickname: schema.users.nickname,
      role: schema.users.role,
    })
    .from(schema.messages)
    .leftJoin(schema.users, eq(schema.messages.userId, schema.users.id))
    .where(eq(schema.messages.channelId, channelId))
    .orderBy(desc(schema.messages.createdAt))
    .limit(limit);

  return rows
    .reverse()
    .filter((m) => m.content && m.type === "text")
    .map((m) => ({
      role: m.role === "bot" ? ("assistant" as const) : ("user" as const),
      content: m.content as string,
      nickname: m.nickname || "anonymous",
    }));
}

// ============================================================
// Image generation gateway (OpenAI-compatible /images/generations)
// ============================================================

export interface ImageGatewayResult {
  url: string; // Blob URL
  mimeType: string;
  fileName: string;
}

/**
 * Call the configured image model. Supports OpenAI-compatible images API
 * (gpt-image-1 / dall-e-3 / any custom endpoint with the same shape).
 * The generated b64 payload is uploaded to Vercel Blob and its URL returned.
 */
export async function generateImage(
  profile: typeof schema.botProfiles.$inferSelect,
  prompt: string
): Promise<ImageGatewayResult> {
  if (!profile.imageApiKey) {
    throw new Error("Bot image gateway is not configured. Add an API key in Settings → Bot.");
  }

  const baseUrl = (profile.imageBaseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = profile.imageModel || "gpt-image-1";
  const provider = profile.imageProvider || "openai";

  // Build a body that the target gateway accepts.
  // Non-OpenAI proxies (Agnes, LiteLLM-forwarded t2i models) reject
  // response_format / size / n — keep those only for native OpenAI.
  const body: Record<string, unknown> = { model, prompt };
  if (provider === "openai") {
    body.n = 1;
    body.size = "1024x1024";
    body.response_format = "b64_json";
  }

  const res = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${profile.imageApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Image API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  // OpenAI-compatible endpoints return b64_json; some proxies (Agnes, etc.)
  // return a URL directly. Support both.
  const item = data?.data?.[0];
  const b64 = item?.b64_json;
  const url = item?.url;
  if (!b64 && !url) {
    throw new Error("Image API returned no data (no b64_json or url). Check gateway config.");
  }

  // Charge the tenant for the generated image (per-model selling price).
  await chargeImage(profile.tenantId, provider, model).catch(() => {});

  // If the gateway returned a direct URL, skip re-upload and return it.
  if (url) {
    return {
      url,
      mimeType: "image/png",
      fileName: `bot-${generateId(16)}.png`,
    };
  }

  const buffer = Buffer.from(b64, "base64");
  const mediaId = `med_${generateId(16)}`;
  const blob = await put(`${profile.tenantId}/bot/${mediaId}.png`, buffer, {
    access: "public",
    contentType: "image/png",
  });

  return {
    url: blob.url,
    mimeType: "image/png",
    fileName: `bot-${mediaId}.png`,
  };
}

/**
 * Same as generateImage but returns the raw PNG bytes (needed when we want to
 * embed metadata into the image, e.g. a SillyTavern character card chunk).
 */
export async function generateImageBytes(
  profile: typeof schema.botProfiles.$inferSelect,
  prompt: string
): Promise<Buffer> {
  if (!profile.imageApiKey) {
    throw new Error("Bot image gateway is not configured. Add an API key in Settings → Bot.");
  }

  const baseUrl = (profile.imageBaseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = profile.imageModel || "gpt-image-1";
  const provider = profile.imageProvider || "openai";

  const body: Record<string, unknown> = { model, prompt };
  if (provider === "openai") {
    body.n = 1;
    body.size = "1024x1024";
    body.response_format = "b64_json";
  }

  const res = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${profile.imageApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Image API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const item = data?.data?.[0];
  const b64 = item?.b64_json;
  const url = item?.url;
  if (b64) return Buffer.from(b64, "base64");
  if (url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Failed to download generated image: ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error("Image API returned no data (no b64_json or url). Check gateway config.");
}

// ============================================================
// Image queue (cooldown + ordering)
// ============================================================

export interface QueueStatus {
  canTrigger: boolean;
  cooldownMsRemaining: number;
  queueLength: number;
  position: number; // 0 = processing now
  currentStatus: string | null;
}

/** Check whether a new /imagine is allowed (cooldown + queue rules). */
export async function getImageQueueStatus(
  tenantId: string
): Promise<QueueStatus> {
  const profile = await ensureBotProfile(tenantId);
  const cooldownMs = profile.imageCooldownMs ?? 180000;

  let cooldownMsRemaining = 0;
  if (profile.lastImageAt) {
    const elapsed = Date.now() - new Date(profile.lastImageAt).getTime();
    if (elapsed < cooldownMs) {
      cooldownMsRemaining = cooldownMs - elapsed;
    }
  }

  const pending = await db
    .select()
    .from(schema.botImageJobs)
    .where(
      and(
        eq(schema.botImageJobs.tenantId, tenantId),
        eq(schema.botImageJobs.status, "queued")
      )
    )
    .orderBy(asc(schema.botImageJobs.createdAt));

  // Find whether any job is currently processing
  const [processing] = await db
    .select()
    .from(schema.botImageJobs)
    .where(
      and(
        eq(schema.botImageJobs.tenantId, tenantId),
        eq(schema.botImageJobs.status, "processing")
      )
    )
    .limit(1);

  return {
    canTrigger: cooldownMsRemaining === 0,
    cooldownMsRemaining,
    queueLength: pending.length + (processing ? 1 : 0),
    position: pending.length + (processing ? 1 : 0),
    currentStatus: processing ? "processing" : (pending.length > 0 ? "queued" : null),
  };
}

/** Enqueue a new image job. Throws if cooldown is active. */
export async function enqueueImageJob(params: {
  tenantId: string;
  channelId: string;
  requestedBy: string;
  prompt: string;
}): Promise<{ jobId: string; queueStatus: QueueStatus }> {
  const { tenantId, channelId, requestedBy, prompt } = params;
  const profile = await ensureBotProfile(tenantId);

  // Cooldown gate
  const cooldownMs = profile.imageCooldownMs ?? 180000;
  if (profile.lastImageAt) {
    const elapsed = Date.now() - new Date(profile.lastImageAt).getTime();
    if (elapsed < cooldownMs) {
      const remaining = cooldownMs - elapsed;
      throw new Error(
        `Image generation is on cooldown. Try again in ${Math.ceil(remaining / 1000)}s.`
      );
    }
  }

  const jobId = `imgq_${generateId(16)}`;
  await db.insert(schema.botImageJobs).values({
    id: jobId,
    tenantId,
    channelId,
    requestedBy,
    prompt: prompt.slice(0, 2000),
    status: "queued",
  });

  const queueStatus = await getImageQueueStatus(tenantId);
  return { jobId, queueStatus };
}

/**
 * Process queued image jobs. Because Vercel serverless has no background
 * worker, this is called lazily: after enqueue and on queue polls.
 * Only one job is processed per invocation to stay within runtime limits.
 */
export async function processNextImageJob(): Promise<{
  processed: boolean;
  result?: { jobId: string; imageUrl: string };
}> {
  // Claim the oldest queued job
  const [job] = await db
    .select()
    .from(schema.botImageJobs)
    .where(eq(schema.botImageJobs.status, "queued"))
    .orderBy(asc(schema.botImageJobs.createdAt))
    .limit(1);

  if (!job) return { processed: false };

  const [profile] = await db
    .select()
    .from(schema.botProfiles)
    .where(eq(schema.botProfiles.tenantId, job.tenantId))
    .limit(1);

  if (!profile) {
    await db
      .update(schema.botImageJobs)
      .set({ status: "failed", error: "Bot profile missing" })
      .where(eq(schema.botImageJobs.id, job.id));
    return { processed: false };
  }

  // Mark processing
  await db
    .update(schema.botImageJobs)
    .set({ status: "processing" })
    .where(eq(schema.botImageJobs.id, job.id));

  try {
    const img = await generateImage(profile, job.prompt);

    await db
      .update(schema.botImageJobs)
      .set({
        status: "done",
        imageUrl: img.url,
        processedAt: new Date().toISOString(),
      })
      .where(eq(schema.botImageJobs.id, job.id));

    // Update cooldown anchor
    await db
      .update(schema.botProfiles)
      .set({ lastImageAt: new Date().toISOString() })
      .where(eq(schema.botProfiles.id, profile.id));

    // Record media + post message to the channel as the bot
    await postBotImageMessage(job, img);

    return { processed: true, result: { jobId: job.id, imageUrl: img.url } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Image generation failed";
    await db
      .update(schema.botImageJobs)
      .set({ status: "failed", error: msg, processedAt: new Date().toISOString() })
      .where(eq(schema.botImageJobs.id, job.id));
    return { processed: false };
  }
}

/** Post a generated image into the channel as a bot message (text + media). */
async function postBotImageMessage(
  job: typeof schema.botImageJobs.$inferSelect,
  img: ImageGatewayResult
) {
  const bot = await ensureBotUser(job.tenantId);

  const messageId = `msg_${generateId(16)}`;
  const mediaId = `med_${generateId(16)}`;

  const caption = `🖼 **${job.requestedBy ? "Image ready" : "Image ready"}** — “${job.prompt.slice(0, 120)}”`;

  await db.insert(schema.messages).values({
    id: messageId,
    tenantId: job.tenantId,
    channelId: job.channelId,
    userId: bot.userId,
    content: caption,
    type: "media",
  });

  await db.insert(schema.media).values({
    id: mediaId,
    tenantId: job.tenantId,
    messageId,
    uploaderId: bot.userId,
    fileName: img.fileName,
    mimeType: img.mimeType,
    mediaType: "image",
    fileSize: 0,
    storageUrl: img.url,
  });

  const [message] = await db
    .select({
      id: schema.messages.id,
      content: schema.messages.content,
      type: schema.messages.type,
      createdAt: schema.messages.createdAt,
      userId: schema.messages.userId,
      nickname: schema.users.nickname,
      avatarSeed: schema.users.avatarSeed,
    })
    .from(schema.messages)
    .leftJoin(schema.users, eq(schema.messages.userId, schema.users.id))
    .where(eq(schema.messages.id, messageId))
    .limit(1);

  if (message) {
    broadcastToChannel(job.channelId, {
      type: "new_message",
      message: { ...message, media: [{ id: mediaId, storageUrl: img.url, mediaType: "image", fileName: img.fileName, mimeType: img.mimeType }] },
    });
  }
}

/** Post a plain text bot message to a channel (e.g. command feedback). */
export async function postBotTextMessage(params: {
  tenantId: string;
  channelId: string;
  content: string;
  type?: string;
}) {
  const bot = await ensureBotUser(params.tenantId);
  const messageId = `msg_${generateId(16)}`;

  await db.insert(schema.messages).values({
    id: messageId,
    tenantId: params.tenantId,
    channelId: params.channelId,
    userId: bot.userId,
    content: params.content.slice(0, 4000),
    type: params.type || "text",
  });

  const [message] = await db
    .select({
      id: schema.messages.id,
      content: schema.messages.content,
      type: schema.messages.type,
      createdAt: schema.messages.createdAt,
      userId: schema.messages.userId,
      nickname: schema.users.nickname,
      avatarSeed: schema.users.avatarSeed,
    })
    .from(schema.messages)
    .leftJoin(schema.users, eq(schema.messages.userId, schema.users.id))
    .where(eq(schema.messages.id, messageId))
    .limit(1);

  if (message) {
    broadcastToChannel(params.channelId, { type: "new_message", message });
  }
  return message;
}

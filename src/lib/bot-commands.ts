import { generateText } from "ai";
import { getModelForTenant } from "@/lib/llm-gateway";
import { ensureTenantBalance } from "./deepseek-billing";
import {
  ensureBotProfile,
  enqueueImageJob,
  getImageQueueStatus,
  readChannelContext,
  postBotTextMessage,
} from "./bot";

// ============================================================
// Slash-command parser + handlers (Discord-style)
// ============================================================

export interface BotCommandContext {
  tenantId: string;
  channelId: string;
  userId: string;
  nickname: string;
}

export interface CommandResult {
  handled: boolean;
  reply?: string; // immediate feedback
  error?: string;
}

const COMMANDS = [
  { name: "imagine", usage: "/imagine <description>", desc: "Generate an image (3-min cooldown, queued)" },
  { name: "chat", usage: "/chat <message>", desc: "Talk to the bot with chat context" },
  { name: "queue", usage: "/queue", desc: "Show image queue status" },
  { name: "help", usage: "/help", desc: "List commands" },
];

/** Parse a raw message; returns null if it is not a command. */
export function parseCommand(raw: string): { name: string; args: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;

  const [name, ...rest] = trimmed.slice(1).split(/\s+/);
  if (!name) return null;
  return { name: name.toLowerCase(), args: rest.join(" ").trim() };
}

/**
 * Handle a slash command. Returns handled=true if the message was a command.
 * For async generation (imagine) the bot may reply immediately and queue work.
 */
export async function handleBotCommand(
  ctx: BotCommandContext,
  raw: string
): Promise<CommandResult> {
  const parsed = parseCommand(raw);
  if (!parsed) return { handled: false };

  const profile = await ensureBotProfile(ctx.tenantId);
  if (!profile.isEnabled) {
    return { handled: true, reply: "🤖 The bot is disabled in this space." };
  }

  switch (parsed.name) {
    case "help":
      return {
        handled: true,
        reply:
          "**Bot commands**\n" +
          COMMANDS.map((c) => `\`${c.usage}\` — ${c.desc}`).join("\n"),
      };

    case "queue": {
      const status = await getImageQueueStatus(ctx.tenantId);
      const cooldown = status.cooldownMsRemaining > 0
        ? ` · cooldown ${Math.ceil(status.cooldownMsRemaining / 1000)}s`
        : "";
      return {
        handled: true,
        reply:
          `**Image queue** — ${status.queueLength} job(s)${cooldown}\n` +
          (status.currentStatus === "processing"
            ? "A job is generating right now."
            : status.queueLength > 0
              ? "Jobs are waiting in queue."
              : "Queue is empty. Use `/imagine` to generate."),
      };
    }

    case "imagine": {
      if (!parsed.args) {
        return { handled: true, error: "Usage: `/imagine <description>` — describe the image you want." };
      }
      try {
        const { jobId, queueStatus } = await enqueueImageJob({
          tenantId: ctx.tenantId,
          channelId: ctx.channelId,
          requestedBy: ctx.userId,
          prompt: parsed.args,
        });
        const position = queueStatus.queueLength;
        const msg =
          position === 1
            ? `🎨 Generating “${parsed.args.slice(0, 80)}”… (position #1)`
            : `🎨 Queued “${parsed.args.slice(0, 80)}”… (position #${position})`;
        // Fire-and-forget processing (serverless-friendly)
        processNextImageJobAsync();
        return { handled: true, reply: msg };
      } catch (err) {
        return {
          handled: true,
          error: err instanceof Error ? err.message : "Failed to enqueue image job.",
        };
      }
    }

    case "chat": {
      if (!parsed.args) {
        return { handled: true, error: "Usage: `/chat <message>` — talk to the bot." };
      }
      // Generate a reply with channel context, then post as bot.
      try {
        await chatWithContext(ctx, parsed.args);
        return { handled: true }; // reply is posted asynchronously via postBotTextMessage
      } catch (err) {
        return {
          handled: true,
          error: err instanceof Error ? err.message : "Bot chat failed.",
        };
      }
    }

    default:
      return {
        handled: true,
        error: `Unknown command \`/${parsed.name}\`. Try \`/help\` for the command list.`,
      };
  }
}

/** Fire-and-forget wrapper: process the next queued image job. */
function processNextImageJobAsync() {
  import("@/lib/bot").then((m) => m.processNextImageJob()).catch(() => {});
}

/** /chat handler: read channel context, call the tenant LLM, post reply as bot. */
async function chatWithContext(ctx: BotCommandContext, userText: string) {
  const profile = await ensureBotProfile(ctx.tenantId);
  const history = await readChannelContext(ctx.channelId, 20);

  const routed = await getModelForTenant(ctx.tenantId, userText);
  if (!routed) {
    await postBotTextMessage({
      tenantId: ctx.tenantId,
      channelId: ctx.channelId,
      content: "⚠️ No LLM provider is configured. Add one in Settings → AI Providers, then try again.",
    });
    return;
  }

  // Credit gate — refuse when prepaid balance is exhausted.
  const bal = await ensureTenantBalance(ctx.tenantId);
  if ((bal.balanceCents ?? 0) <= 0) {
    await postBotTextMessage({
      tenantId: ctx.tenantId,
      channelId: ctx.channelId,
      content: "⚠️ 空间额度已用完，请管理员充值后再试。",
    });
    return;
  }

  const systemPrompt =
    profile.systemPrompt ||
    "You are a helpful assistant inside an anonymous chat space. You read the conversation and reply naturally. Keep replies concise.";

  const messages = [
    ...history.map((h) => ({
      role: h.role as "user" | "assistant",
      content: `${h.nickname}: ${h.content}`,
    })),
    { role: "user" as const, content: `${ctx.nickname}: ${userText}` },
  ];

  const { text } = await generateText({
    model: routed.provider.model(routed.provider.modelId),
    system: systemPrompt,
    messages,
    temperature: 0.8,
  });

  await postBotTextMessage({
    tenantId: ctx.tenantId,
    channelId: ctx.channelId,
    content: text || "(bot returned an empty reply)",
  });
}

export { COMMANDS };

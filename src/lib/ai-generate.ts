import { generateText } from "ai";
import { getModelForTenant } from "./llm-gateway";
import { ensureTenantBalance } from "./deepseek-billing";
import { chargeTokens } from "./pricing";

/**
 * Shared AI-generation helper for structured content (character cards,
 * world books). Routes through the tenant's configured LLM, gates on
 * prepaid credit, and charges tokens — same economics as roleplay chat.
 *
 * Throws Error("INSUFFICIENT_CREDIT") when balance is exhausted and
 * Error("NO_PROVIDER") when no provider is configured — routes translate
 * these into user-facing messages.
 */
export async function aiGenerateText(
  tenantId: string,
  opts: {
    system: string;
    user: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  const { system, user, maxTokens = 1400, temperature = 0.9 } = opts;

  const balance = await ensureTenantBalance(tenantId);
  if ((balance.balanceCents ?? 0) <= 0) {
    throw new Error("INSUFFICIENT_CREDIT");
  }
  const routed = await getModelForTenant(tenantId, user);
  if (!routed) {
    throw new Error("NO_PROVIDER");
  }

  const { text, usage } = await generateText({
    model: routed.provider.model(routed.provider.modelId),
    system,
    messages: [{ role: "user", content: user }],
    temperature,
    maxTokens,
  });

  if (usage) {
    const total = (usage as { totalTokens?: number }).totalTokens ?? 0;
    await chargeTokens(tenantId, routed.provider.provider, routed.provider.modelId, total, 0);
  }
  return text;
}

/**
 * Extract a JSON value from an LLM reply. Models often wrap output in
 * ```json fences or add prose around it — strip and try progressively.
 */
export function extractJson<T>(text: string): T | null {
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  try {
    return JSON.parse(s) as T;
  } catch {
    /* fall through */
  }

  const objStart = s.indexOf("{");
  const objEnd = s.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) {
    try {
      return JSON.parse(s.slice(objStart, objEnd + 1)) as T;
    } catch {
      /* fall through */
    }
  }

  const arrStart = s.indexOf("[");
  const arrEnd = s.lastIndexOf("]");
  if (arrStart >= 0 && arrEnd > arrStart) {
    try {
      return JSON.parse(s.slice(arrStart, arrEnd + 1)) as T;
    } catch {
      /* fall through */
    }
  }
  return null;
}

/** Natural-language name for the current UI locale, for generation prompts. */
export function localeName(locale: string | null | undefined): string {
  return locale === "zh" ? "中文" : "English";
}

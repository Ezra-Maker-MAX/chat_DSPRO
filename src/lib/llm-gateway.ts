import { db, schema } from "@/lib/db";
import { eq, and, asc } from "drizzle-orm";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

type ProviderType = "openai" | "anthropic" | "deepseek" | "google";

interface RoutedModel {
  model: ReturnType<typeof createOpenAI> | ReturnType<typeof createAnthropic>;
  modelId: string;
  provider: ProviderType;
}

export async function getModelForTenant(
  tenantId: string,
  prompt?: string
): Promise<{ provider: RoutedModel; config: typeof schema.llmRoutes.$inferSelect } | null> {
  // Get all active routes for this tenant, ordered by priority
  const routes = await db
    .select()
    .from(schema.llmRoutes)
    .where(
      and(
        eq(schema.llmRoutes.tenantId, tenantId),
        eq(schema.llmRoutes.isActive, true)
      )
    )
    .orderBy(asc(schema.llmRoutes.priority));

  if (routes.length === 0) return null;

  // Match route by condition
  let matchedRoute = routes[0]; // default to first (lowest priority = catch-all)
  if (prompt) {
    for (const route of routes) {
      if (route.condition !== "*") {
        try {
          const regex = new RegExp(route.condition, "i");
          if (regex.test(prompt)) {
            matchedRoute = route;
            break;
          }
        } catch {
          // invalid regex, skip
        }
      }
    }
  }

  // Get the provider config
  const [providerConfig] = await db
    .select()
    .from(schema.llmProviders)
    .where(eq(schema.llmProviders.id, matchedRoute.providerId))
    .limit(1);

  if (!providerConfig || !providerConfig.isActive) return null;

  const routed = createProviderModel(
    providerConfig.provider as ProviderType,
    providerConfig.apiKey,
    providerConfig.model,
    providerConfig.baseUrl ?? undefined
  );

  if (!routed) return null;

  return {
    provider: routed,
    config: matchedRoute,
  };
}

function createProviderModel(
  provider: ProviderType,
  apiKey: string,
  modelId: string,
  baseUrl?: string
): RoutedModel | null {
  try {
    switch (provider) {
      case "openai": {
        const client = createOpenAI({ apiKey, baseURL: baseUrl });
        return { model: client, modelId, provider };
      }
      case "anthropic": {
        const client = createAnthropic({ apiKey, baseURL: baseUrl });
        return { model: client, modelId, provider };
      }
      case "deepseek": {
        const client = createDeepSeek({ apiKey, baseURL: baseUrl });
        return { model: client, modelId, provider };
      }
      case "google": {
        const client = createGoogleGenerativeAI({ apiKey, baseURL: baseUrl });
        return { model: client, modelId, provider };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export type { ProviderType, RoutedModel };

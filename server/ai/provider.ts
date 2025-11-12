import type { AIProvider } from "./types.js";
import { GeminiProvider } from "./gemini-provider.js";
import { OpenAIProvider } from "./openai-provider.js";
import { db } from "../db.js";
import { agencySettings } from "@shared/schema.js";
import { eq } from "drizzle-orm";

// Cache providers by agency ID for performance
const providerCache = new Map<string, AIProvider>();

export async function getAIProvider(agencyId?: string): Promise<AIProvider> {
  // Determine which provider to use
  let providerName = "gemini"; // Default fallback

  if (agencyId) {
    // Check cache first
    const cacheKey = `${agencyId}`;
    if (providerCache.has(cacheKey)) {
      return providerCache.get(cacheKey)!;
    }

    // Query database for agency-specific setting
    try {
      const settings = await db
        .select()
        .from(agencySettings)
        .where(eq(agencySettings.agencyId, agencyId))
        .limit(1);

      if (settings.length > 0 && settings[0].aiProvider) {
        providerName = settings[0].aiProvider.toLowerCase();
      } else {
        // Fall back to environment variable
        providerName = process.env.AI_PROVIDER?.toLowerCase() || "gemini";
      }
    } catch (error) {
      console.error("Error fetching agency AI provider settings:", error);
      // Fall back to environment variable
      providerName = process.env.AI_PROVIDER?.toLowerCase() || "gemini";
    }

    // Create and cache provider
    const provider = createProvider(providerName);
    providerCache.set(cacheKey, provider);
    return provider;
  }

  // No agency ID provided - use environment variable or default
  const cacheKey = "__default__";
  if (providerCache.has(cacheKey)) {
    return providerCache.get(cacheKey)!;
  }

  providerName = process.env.AI_PROVIDER?.toLowerCase() || "gemini";
  const provider = createProvider(providerName);
  providerCache.set(cacheKey, provider);
  return provider;
}

function createProvider(providerName: string): AIProvider {
  switch (providerName) {
    case "openai":
      console.log("🤖 AI Provider: OpenAI");
      return new OpenAIProvider();
    case "gemini":
    default:
      console.log("🤖 AI Provider: Gemini");
      return new GeminiProvider();
  }
}

export function invalidateAIProviderCache(agencyId?: string): void {
  if (agencyId) {
    providerCache.delete(`${agencyId}`);
    console.log(`🔄 AI provider cache invalidated for agency: ${agencyId}`);
  } else {
    providerCache.clear();
    console.log("🔄 All AI provider cache cleared");
  }
}

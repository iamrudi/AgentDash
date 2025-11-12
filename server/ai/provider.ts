import type { AIProvider } from "./types.js";
import { GeminiProvider } from "./gemini-provider.js";
import { OpenAIProvider } from "./openai-provider.js";

let cachedProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const provider = process.env.AI_PROVIDER?.toLowerCase() || "gemini";

  switch (provider) {
    case "openai":
      cachedProvider = new OpenAIProvider();
      console.log("🤖 AI Provider: OpenAI");
      break;
    case "gemini":
    default:
      cachedProvider = new GeminiProvider();
      console.log("🤖 AI Provider: Gemini");
      break;
  }

  return cachedProvider!;
}

export function resetAIProvider(): void {
  cachedProvider = null;
}

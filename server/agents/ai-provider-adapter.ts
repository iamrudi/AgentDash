import { AIProvider } from "./base-agent";
import { z } from "zod";
import { hardenedAIExecutor } from "../ai/hardened-executor";

export function createAIProvider(): AIProvider {
  return {
    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
      const provider = process.env.AI_PROVIDER?.toLowerCase() || "gemini";
      const model = provider === "openai" ? "gpt-4o" : "gemini-2.0-flash";
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

      const result = await hardenedAIExecutor.executeWithSchema(
        {
          agencyId: "legacy",
          operation: "agentGenerateText",
          provider,
          model,
        },
        {
          prompt: fullPrompt,
          model,
          temperature: 0.7,
        },
        z.string()
      );

      if (!result.success || !result.data) {
        throw new Error(result.error || "AI generation failed");
      }

      return cleanJsonResponse(result.data);
    }
  };
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  
  return cleaned.trim();
}

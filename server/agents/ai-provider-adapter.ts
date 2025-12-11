import { AIProvider } from "./base-agent";

export function createAIProvider(): AIProvider {
  return {
    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      const openaiApiKey = process.env.OPENAI_API_KEY;

      if (geminiApiKey) {
        return generateWithGemini(prompt, systemPrompt, geminiApiKey);
      } else if (openaiApiKey) {
        return generateWithOpenAI(prompt, systemPrompt, openaiApiKey);
      } else {
        throw new Error("No AI provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY.");
      }
    }
  };
}

async function generateWithGemini(
  prompt: string,
  systemPrompt: string | undefined,
  apiKey: string
): Promise<string> {
  const { GoogleGenAI } = await import("@google/genai");
  const genAI = new GoogleGenAI({ apiKey });

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  const response = await genAI.models.generateContent({
    model: "gemini-2.0-flash",
    contents: fullPrompt,
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  return cleanJsonResponse(text);
}

async function generateWithOpenAI(
  prompt: string,
  systemPrompt: string | undefined,
  apiKey: string
): Promise<string> {
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0.7,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("Empty response from OpenAI");
  }

  return cleanJsonResponse(text);
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

// src/services/AiService.ts
import { GoogleGenAI } from "@google/genai";
import { getGlobalConfig } from "../utils/config.js";

export interface AiOptions {
  model?: string;
  systemInstruction?: string;
  isJson?: boolean;
  history?: any[]; // For stateful Architect chats
  onRetry?: (error: Error) => Promise<boolean>;
}

export class AiService {
  private static client: any = null;

  private static getClient() {
    if (!this.client) {
      const config = getGlobalConfig();
      if (!config.apiKey) throw new Error("API Key not found.");
      // New Unified SDK initialization
      this.client = new GoogleGenAI({ apiKey: config.apiKey });
    }
    return this.client;
  }

  /**
   * Surgical execution loop with retry logic.
   */
  static async execute(prompt: string, options: AiOptions): Promise<string> {
    const ai = this.getClient();
    const modelId = options.model || "gemini-2.0-flash";

    while (true) {
      try {
        const response = await ai.models.generateContent({
          model: modelId,

          systemInstruction: options.systemInstruction,
          // Support for both single-turn (prompt) and multi-turn (history)
          contents: options.history
            ? [...options.history, { role: "user", parts: [{ text: prompt }] }]
            : [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            systemInstruction: options.systemInstruction,
            responseMimeType: options.isJson ? "application/json" : undefined,
          },
        });

        return response.text;
      } catch (error: any) {
        const isRecoverable =
          error.message?.includes("503") || error.message?.includes("429");
        if (isRecoverable && options.onRetry) {
          if (await options.onRetry(error)) continue;
        }
        throw error;
      }
    }
  }
}

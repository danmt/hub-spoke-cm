// src/services/AiService.ts
import { GoogleGenAI } from "@google/genai";
import { getGlobalConfig } from "../utils/config.js";
import { LoggerService } from "./LoggerService.js";

export interface AiOptions {
  model?: string;
  systemInstruction?: string;
  history?: any[];
}

export class AiService {
  private static client: any = null;

  private static getClient() {
    if (!this.client) {
      const config = getGlobalConfig();
      if (!config.apiKey) throw new Error("API Key not found.");
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

    // Trace: Log the outgoing request details
    await LoggerService.debug("AI Request Initiated", {
      modelId,
      promptSnippet: prompt,
      systemInstructionSnippet: options.systemInstruction,
      history: !!options.history,
    });

    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: options.history
          ? [...options.history, { role: "user", parts: [{ text: prompt }] }]
          : [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: options.systemInstruction,
        },
      });

      const text = response.text;

      // Trace: Log successful response
      await LoggerService.debug("AI Response Received", {
        textSnippet: text,
      });

      return text;
    } catch (error: any) {
      // Trace: Record failure details
      await LoggerService.error("AI Execution Error", {
        code: error.error?.code,
        message: error.message,
        stack: error.stack,
        modelId,
      });

      // If no handler or handler returns false, propagate the error
      throw error;
    }
  }
}

// packages/core/src/services/AiService.ts
import { GoogleGenAI } from "@google/genai";
import { LoggerService } from "./LoggerService.js";

export interface AiOptions {
  apiKey: string; // REQUIRED now
  model?: string;
  systemInstruction?: string;
  history?: any[];
}

export class AiService {
  /**
   * Pure stateless execution.
   */
  static async execute(prompt: string, options: AiOptions): Promise<string> {
    const { apiKey, model: modelId = "gemini-2.0-flash" } = options;

    // We create the client on the fly. It's fast and stateless.
    const genAI = new GoogleGenAI({ apiKey });

    await LoggerService.debug("AI Request Initiated", { modelId });

    try {
      const response = await genAI.models.generateContent({
        model: modelId,
        contents: options.history
          ? [...options.history, { role: "user", parts: [{ text: prompt }] }]
          : [{ role: "user", parts: [{ text: prompt }] }],
        config: { systemInstruction: options.systemInstruction },
      });

      return response.text!;
    } catch (error: any) {
      await LoggerService.error("AI Execution Error", {
        message: error.message,
      });
      throw error;
    }
  }
}

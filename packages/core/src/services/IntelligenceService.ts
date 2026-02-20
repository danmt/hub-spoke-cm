import { AgentTruth } from "../types/index.js";
import { MAX_TRUTHS_FOR_CONTEXT } from "../utils/consts.js";
import { AiService } from "./AiService.js";

export class IntelligenceService {
  /**
   * Generates a functional description based on behavior and known truths.
   */
  static async generateInferredDescription(
    apiKey: string,
    model: string,
    displayName: string,
    behavior: string,
    truths: AgentTruth[] = [],
  ): Promise<string> {
    const relevantTruths = truths
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_TRUTHS_FOR_CONTEXT)
      .map((t) => `- ${t.text}`)
      .join("\n");

    const prompt = `
      Based on the following agent name and behavior, write a concise one-sentence functional description for a registry.
      
      NAME: ${displayName}
      BEHAVIOR: ${behavior}
      ${relevantTruths.length > 0 ? `LEARNED TRUTHS:\n${relevantTruths}` : ""}
      
      Output only the description string.
    `.trim();

    return await AiService.execute(prompt, { apiKey, model });
  }
}

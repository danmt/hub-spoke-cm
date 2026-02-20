import { AgentTruth } from "../types/index.js";
import { MAX_TRUTHS_FOR_CONTEXT } from "../utils/consts.js";
import { AiService } from "./AiService.js";

/**
 * Results of a knowledge migration during a manual behavior change.
 */
export interface KnowledgeMigrationResult {
  keptTruths: AgentTruth[];
  thoughtProcess: string;
}

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
    metadata: Record<string, any> = {},
  ): Promise<string> {
    const relevantTruths = truths
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_TRUTHS_FOR_CONTEXT)
      .map((t) => `- ${t.text}`)
      .join("\n");
    const metaContext = Object.entries(metadata)
      .map(([key, value]) => `${key.toUpperCase()}: ${value}`)
      .join("\n");

    const prompt = `
      Based on the following agent name and behavior, write a concise one-sentence functional description for a registry.
      
      NAME: ${displayName}
      ${metaContext ? `TRAITS:\n${metaContext}` : ""}
      BEHAVIOR: ${behavior}
      ${relevantTruths.length > 0 ? `LEARNED TRUTHS:\n${relevantTruths}` : ""}
      
      Output only the description string.
    `.trim();

    return await AiService.execute(prompt, { apiKey, model });
  }

  /**
   * Evaluates existing knowledge against a new behavior instruction.
   * Discards or modifies truths that are no longer compatible with the new core logic.
   * This is the "Smart Fork" engine for manual evolution.
   */
  static async migrateKnowledge(
    apiKey: string,
    model: string,
    newBehavior: string,
    existingTruths: AgentTruth[],
  ): Promise<KnowledgeMigrationResult> {
    const truthsContext = existingTruths.map((t) => `- ${t.text}`).join("\n");

    const systemInstruction = `
      You are a Knowledge Migration Engine. 
      An AI agent's core instructions (Behavior) are being changed. 
      Your task is to review its existing "Rooted Truths" (Memory) and decide which ones are still valid under the new rules.

      NEW BEHAVIOR:
      ${newBehavior}

      EXISTING TRUTHS:
      ${truthsContext || "No existing truths."}

      RULES:
      1. PRESERVE (Fact over Vibe): If a truth contains technical facts, project details, or historical data (e.g., "The project uses Tailwind"), it MUST be kept.
      2. REVISE (Identity Alignment): If a truth is semantically valid but the phrasing contradicts the new persona (e.g., old: "I hate RSC", new: "Professional Developer"), REWRITE the text to be compatible (e.g., "Maintains a critical, trade-off-based view of RSC implementation").
      3. DISCARD (Logical Impossibility): Only discard if the truth is fundamentally impossible under the new behavior (e.g., Old: "I only speak Spanish", New: "English-only Translator").

      OUTPUT FORMAT (JSON):
      {
        "thoughtProcess": "Brief explanation of what was kept and why.",
        "keptTruths": [
          { "text": "The original or slightly refined truth text", "weight": 0.5 }
        ]
      }
    `.trim();

    const responseText = await AiService.execute(
      "Compare the truths against the new behavior and filter them.",
      {
        apiKey,
        model,
        systemInstruction,
      },
    );

    try {
      const jsonString = responseText.replace(/```json|```/g, "").trim();
      const result = JSON.parse(jsonString);

      return {
        thoughtProcess: result.thoughtProcess,
        keptTruths: result.keptTruths,
      };
    } catch (error: any) {
      throw new Error(`Knowledge migration failed: ${error.message}`);
    }
  }
}

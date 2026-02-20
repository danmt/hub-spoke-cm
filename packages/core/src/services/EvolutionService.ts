// packages/core/src/services/EvolutionService.ts
import {
  AgentKnowledge,
  AgentTruth,
  EvolutionAnalysis,
  EvolutionAnalysisSchema,
} from "../types/index.js";
import { AiService } from "./AiService.js";
import { LoggerService } from "./LoggerService.js";

export interface EvolutionContext {
  apiKey: string;
  model: string;
  displayName: string;
  behavior: string;
  knowledge: AgentKnowledge;
  feedbackBuffer: string; // Raw JSONL content
}

export class EvolutionService {
  /**
   * Analyzes feedback logs to propose semantic memory updates.
   */
  static async analyzeEvolution(
    ctx: EvolutionContext,
  ): Promise<EvolutionAnalysis> {
    await LoggerService.info(
      `EvolutionService: Analyzing history for ${ctx.displayName}`,
    );

    const existingTruths = ctx.knowledge.truths
      .map((t) => `- ${t.text} (Weight: ${t.weight})`)
      .join("\n");

    const systemInstruction = `
      You are an Evolution Engine for an Adaptive AI Workforce. 
      Your goal is to extract "Rooted Truths" from user feedback logs to improve agent performance.

      AGENT IDENTITY:
      Name: ${ctx.displayName}
      Core Behavior: ${ctx.behavior}

      CURRENT KNOWLEDGE (Memory):
      ${existingTruths || "No truths rooted yet."}

      FEEDBACK BUFFER (JSONL):
      ${ctx.feedbackBuffer}

      TASK:
      1. Identify patterns in user feedback. If a user asks for something repeatedly, it's a new Truth.
      2. Identify contradictions. If a user corrects a previous behavior, the associated Truth should be weakened.
      3. Propose changes using three actions:
         - "add": Create a new Truth from a detected pattern.
         - "strengthen": Increase weight for a Truth the user explicitly liked or used.
         - "weaken": Decrease weight for a Truth the user explicitly corrected or disliked.

      OUTPUT FORMAT (JSON):
      {
        "thoughtProcess": "Summary of what you learned from the feedback.",
        "proposals": [
          { "text": "The concise instruction", "action": "add|strengthen|weaken", "reasoning": "Why this change?" }
        ]
      }
    `.trim();

    const responseText = await AiService.execute(
      "Analyze the buffer and propose memory updates.",
      {
        apiKey: ctx.apiKey,
        model: ctx.model,
        systemInstruction,
      },
    );

    try {
      // Clean potential markdown blocks from AI response
      const jsonString = responseText.replace(/```json|```/g, "").trim();
      return EvolutionAnalysisSchema.parse(JSON.parse(jsonString));
    } catch (error: any) {
      await LoggerService.error(
        "EvolutionService: Failed to parse AI analysis",
        { error: error.message },
      );
      throw new Error(`Evolution Analysis failed: ${error.message}`);
    }
  }

  /**
   * Applies the proposed changes to the existing knowledge object.
   */
  static applyProposals(
    currentTruths: AgentTruth[],
    proposals: EvolutionAnalysis["proposals"],
  ): AgentTruth[] {
    const updatedTruths = [...currentTruths];
    const WEIGHT_STEP = 0.1;

    for (const prop of proposals) {
      const index = updatedTruths.findIndex(
        (t) => t.text.toLowerCase() === prop.text.toLowerCase(),
      );

      if (prop.action === "add" && index === -1) {
        updatedTruths.push({ text: prop.text, weight: 0.1 });
      } else if (index !== -1) {
        if (prop.action === "strengthen") {
          updatedTruths[index].weight = Math.min(
            1,
            updatedTruths[index].weight + WEIGHT_STEP,
          );
        } else if (prop.action === "weaken") {
          updatedTruths[index].weight = Math.max(
            0,
            updatedTruths[index].weight - WEIGHT_STEP,
          );
        }
      }
    }

    // Filter out completely discredited truths
    return updatedTruths.filter((t) => t.weight > 0);
  }
}

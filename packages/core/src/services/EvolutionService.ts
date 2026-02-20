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
  metadata?: Record<string, any>; // Optional metadata for Personas (Tone, Lang, etc.)
}

export class EvolutionService {
  /**
   * Analyzes feedback logs to propose semantic memory updates or forks.
   * Focuses on semantic contradictions and identity metadata violations.
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

    // Capture metadata specifically for Persona validation
    const identityMeta = ctx.metadata
      ? `IDENTITY METADATA:
         - Tone: ${ctx.metadata.tone || "Neutral"}
         - Language: ${ctx.metadata.language || "English"}
         - Accent: ${ctx.metadata.accent || "Neutral"}`
      : "IDENTITY METADATA: N/A (Standard Agent)";

    const systemInstruction = `
      You are the Evolution Engine for an Adaptive AI Workforce. 
      Your goal is to detect patterns in user feedback and identify when an agent needs to evolve or specialized via a FORK.

      AGENT IDENTITY:
      Name: ${ctx.displayName}
      Core Behavior: ${ctx.behavior}
      ${identityMeta}

      CURRENT KNOWLEDGE (Rooted Truths):
      ${existingTruths || "No truths rooted yet."}

      FEEDBACK BUFFER (Interaction History):
      ${ctx.feedbackBuffer}

      1. **HARD CONFLICT (Requires Fork)**:
        - **Semantic Negation**: The feedback directly contradicts an existing Rooted Truth (e.g., Truth: "I live in London" vs Feedback: "You are from Madrid").
        - **Identity Violation**: The feedback requests a style or persona trait that contradicts the IDENTITY METADATA (Tone, Language, or Accent).
        - **Action**: Set "conflictType" to "hard" and "forkRecommended" to true.
        - **Cleanup Requirement**: You MUST identify the "violatedMetadataField" or "violatedTruth". 
        - **Purge Requirement**: You MUST list all existing truths in "contradictoryTruths" that are incompatible with the new feedback (e.g., if changing accent to Colombian, purge the truth "I am from Madrid").

        2. **SOFT CONFLICT (Requires Learning)**:
        - Feedback adds new information that does not negate existing truths.
        - Feedback requests adjustments in formatting, emphasis, or technical depth.
        - **Action**: Set "conflictType" to "soft" and propose weight adjustments ("strengthen" or "weaken").

      TASK:
      Analyze the buffer. If you find a HARD conflict, identify exactly which Truth or Metadata field was violated. 
      If no contradictions are found, set conflictType to "soft" or "none", forkRecommended to false, and leave violatedTruth/violatedMetadataField as null.

      OUTPUT FORMAT (JSON):
      {
        "thoughtProcess": "Summary of patterns and contradictions detected.",
        "conflictType": "none|soft|hard",
        "forkRecommended": true|false,
        "suggestedForkName": "Name for the new specialized variant",
        "violatedTruth": "The specific truth text that was contradicted",
        "violatedMetadataField": "tone|language|accent",
        "newMetadataValue": "The new specific value (e.g., 'Playful' or 'Sarcastic')",
        "contradictoryTruths": ["List of all other parent truths that must be purged to avoid inconsistencies"],
        "proposals": [
          { "text": "The concise instruction", "action": "add|strengthen|weaken", "reasoning": "Reasoning..." }
        ]
      }
    `.trim();

    const responseText = await AiService.execute(
      "Analyze the buffer for semantic contradictions and metadata violations.",
      {
        apiKey: ctx.apiKey,
        model: ctx.model,
        systemInstruction,
      },
    );

    console.log(responseText);

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
    const WEIGHT_STEP = 0.2; // Increased step for faster learning in Phase 4

    for (const prop of proposals) {
      const index = updatedTruths.findIndex(
        (t) => t.text.toLowerCase() === prop.text.toLowerCase(),
      );

      if (prop.action === "add" && index === -1) {
        updatedTruths.push({ text: prop.text, weight: 0.3 }); // Start higher for new patterns
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

    return updatedTruths.filter((t) => t.weight > 0);
  }
}

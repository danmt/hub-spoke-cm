// src/core/assemblers/index.ts
import { GoogleGenAI } from "@google/genai";
import { HubBlueprint, HubBlueprintSchema } from "../../types/index.js";
import { getGlobalConfig } from "../../utils/config.js";
import { Brief } from "../agents/Architect.js";
export interface Assembler {
  id: string;
  description: string;
  strategyPrompt: string;
  generateSkeleton(brief: Brief): Promise<HubBlueprint>;
}

abstract class BaseAgenticAssembler implements Assembler {
  abstract id: string;
  abstract description: string;
  abstract strategyPrompt: string;
  protected client: GoogleGenAI;

  constructor() {
    const config = getGlobalConfig();
    this.client = new GoogleGenAI({ apiKey: config.apiKey! });
  }

  async generateSkeleton(brief: Brief): Promise<HubBlueprint> {
    const config = getGlobalConfig();
    const model = config.architectModel || "gemini-2-flash";

    const result = await this.client.models.generateContent({
      model: model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
            You are a Content Architect. Generate a dynamic HubBlueprint JSON object.
            STRATEGY: ${this.strategyPrompt}
            TOPIC: ${brief.topic} | GOAL: ${brief.goal} | PERSONA: ${brief.personaId}
            
            TASK: Define sections with catchy, persona-aligned headers. 
            If the topic is complex (e.g., a Fullstack tutorial), expand to include all necessary technical layers (DB, API, Frontend, etc.).
            
            OUTPUT ONLY RAW JSON matching this schema:
            {
              "hubId": "slugified-topic",
              "components": [
                { "id": "unique-id", "header": "Contextual Title", "intent": "Writing instructions", "writerId": "prose|code" }
              ]
            }
          `.trim(),
            },
          ],
        },
      ],
    });

    const rawJson = (result.text ?? "").replace(/```json|```/g, "").trim();
    return HubBlueprintSchema.parse(JSON.parse(rawJson));
  }
}

export class TutorialAssembler extends BaseAgenticAssembler {
  id = "tutorial";
  description =
    "Dynamic step-by-step learning path. Adapts depth to topic complexity.";
  strategyPrompt =
    "Focus on a logical progression from prerequisites to a working final product. If the topic involves multiple stacks, create dedicated implementation sections for each.";
}

export class DeepDiveAssembler extends BaseAgenticAssembler {
  id = "deep-dive";
  description = "Advanced architectural and performance analysis.";
  strategyPrompt =
    "Focus on internals, trade-offs, and edge cases. Headers should reflect senior-level technical scrutiny.";
}

export const ASSEMBLER_REGISTRY: Record<string, Assembler> = {
  tutorial: new TutorialAssembler(),
  "deep-dive": new DeepDiveAssembler(),
};

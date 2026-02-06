import { GoogleGenAI } from "@google/genai";
import { HubBlueprint, HubBlueprintSchema } from "../types/index.js";
import { GlobalConfig } from "../utils/config.js";
import { Brief } from "./Architect.js";

export interface IAssembler {
  id: string;
  description: string;
  strategyPrompt: string;
  writerIds: string[];
  generateSkeleton(brief: Brief): Promise<HubBlueprint>;
}

export class Assembler implements IAssembler {
  constructor(
    protected client: GoogleGenAI,
    protected config: GlobalConfig,
    public id: string,
    public description: string,
    public strategyPrompt: string,
    public writerIds: string[],
  ) {}

  async generateSkeleton(brief: Brief): Promise<HubBlueprint> {
    const model = this.config.architectModel || "gemini-2-flash";

    const writerConstraint =
      this.writerIds.length > 0 ? this.writerIds.join("|") : "prose";

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
            
            TASK: Define a sequential narrative flow. Define sections with catchy, persona-aligned headers. 
            CRITICAL: Every 'intent' must be a clear roadmap for a Writer. 
            Ensure the sequence moves logically from foundation to advanced application without overlapping concepts.
            If the topic is complex, expand to include all necessary layers.

            OUTPUT ONLY RAW JSON matching this schema:
            {
              "hubId": "slugified-topic",
              "components": [
                { 
                  "id": "unique-id", 
                  "header": "Contextual Title", 
                  "intent": "SPECIFIC roadmap instruction for this section. Avoid generalities.", 
                  "writerId": "${writerConstraint}" 
                }
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

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

export abstract class BaseAssembler implements Assembler {
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

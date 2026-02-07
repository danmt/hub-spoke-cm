import { AiService } from "../services/AiService.js";
import { HubBlueprint, HubBlueprintSchema } from "../types/index.js";
import { getGlobalConfig } from "../utils/config.js";
import { Brief } from "./Architect.js";

export interface AssemblerContext {
  brief: Brief;
  onRetry?: (error: Error) => Promise<boolean>;
}

export interface AssemblerResponse {
  strategyPrompt: string;
  blueprint: HubBlueprint;
}

export interface IAssembler {
  id: string;
  description: string;
  strategyPrompt: string;
  writerIds: string[];
  generateSkeleton(ctx: AssemblerContext): Promise<AssemblerResponse>;
}

export class Assembler implements IAssembler {
  constructor(
    public id: string,
    public description: string,
    public strategyPrompt: string,
    public writerIds: string[],
  ) {}

  async generateSkeleton(ctx: AssemblerContext): Promise<AssemblerResponse> {
    const model = getGlobalConfig().architectModel || "gemini-2-flash";

    const writerConstraint =
      this.writerIds.length > 0 ? this.writerIds.join("|") : "prose";

    const systemInstruction = `
      You are a Content Architect. Generate a dynamic HubBlueprint JSON object.
      STRATEGY: ${this.strategyPrompt}
      TOPIC: ${ctx.brief.topic} | GOAL: ${ctx.brief.goal} | PERSONA: ${ctx.brief.personaId}
      
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
    `.trim();

    const text = await AiService.execute(systemInstruction, {
      model,
      isJson: true,
      onRetry: ctx.onRetry,
    });

    const rawJson = text.replace(/```json|```/g, "").trim();
    return {
      blueprint: HubBlueprintSchema.parse(JSON.parse(rawJson)),
      strategyPrompt: this.strategyPrompt,
    };
  }
}

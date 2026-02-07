import { AiService } from "../services/AiService.js";
import { getGlobalConfig } from "../utils/config.js";
import { Persona } from "./Persona.js";

export interface WriterContext {
  header: string;
  intent: string;
  topic: string;
  goal: string;
  audience: string;
  language: string;
  persona: Persona;
  precedingBridge?: string;
  upcomingIntents?: string[];
  isFirst: boolean;
  isLast: boolean;
  onRetry?: (error: Error) => Promise<boolean>;
}

export interface WriterResponse {
  content: string;
  bridge: string;
}

export interface IWriter {
  id: string;
  description: string;
  writingStrategy: string;
  write(ctx: WriterContext): Promise<WriterResponse>;
}

export class Writer implements IWriter {
  constructor(
    public id: string,
    public description: string,
    public writingStrategy: string,
  ) {}

  async write(ctx: WriterContext): Promise<WriterResponse> {
    const modelName = getGlobalConfig().writerModel || "gemini-2.0-flash";

    const systemInstruction = `
      ${ctx.persona.getInstructions(ctx)}
      
      WRITING STRATEGY: ${this.writingStrategy}
              
      TASK GUIDELINES:
      1. Generate the section content based on the INTENT.
      2. Maintain flow by acknowledging the PREVIOUSLY ESTABLISHED context without repeating it.
      3. Do NOT "steal" content from the REMAINING TOPICS.
      4. Provide a "BRIDGE": A short summary of what you wrote to help the next writer maintain continuity.
    `.trim();

    const prompt = `
      SECTION HEADER: ${ctx.header}
      INTENT: ${ctx.intent}
      TOPIC: ${ctx.topic}
      GOAL: ${ctx.goal}
      AUDIENCE: ${ctx.audience}

      PROGRESS CONTEXT:
      ${ctx.isFirst ? "- This is the START of the article." : ""}
      ${ctx.isLast ? "- This is the CONCLUSION of the article." : ""}
      ${ctx.precedingBridge ? `- PREVIOUSLY ESTABLISHED: ${ctx.precedingBridge}` : ""}
      ${ctx.upcomingIntents?.length ? `- REMAINING TOPICS TO BE COVERED: ${ctx.upcomingIntents.join(", ")}` : ""}

      OUTPUT FORMAT (JSON ONLY):
      {
        "content": "The markdown content (omit the H2 header)",
        "bridge": "Context for the next agent"
      }
    `.trim();

    const text = await AiService.execute(prompt, {
      model: modelName,
      systemInstruction,
      isJson: true,
      onRetry: ctx.onRetry,
    });

    const rawJson = text.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(rawJson) as WriterResponse;
    } catch (e) {
      throw new Error(`Writer ${this.id} failed to return valid JSON: ${text}`);
    }
  }
}

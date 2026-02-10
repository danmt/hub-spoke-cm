// src/agents/Writer.ts
import { AiService } from "../services/AiService.js";
import { getGlobalConfig } from "../utils/config.js";
import { Persona } from "./Persona.js";

export interface WriterContext {
  intent: string;
  topic: string;
  goal: string;
  audience: string;
  language: string;
  persona: Persona;
  precedingBridge?: string;
  isFirst: boolean;
  isLast: boolean;
  onRetry?: (error: Error) => Promise<boolean>;
}

export interface WriterResponse {
  content: string;
  bridge: string;
}

export class Writer {
  constructor(
    public id: string,
    public description: string,
    public writingStrategy: string,
  ) {}

  async write(ctx: WriterContext): Promise<WriterResponse> {
    const modelName = getGlobalConfig().writerModel || "gemini-3-flash";

    const systemInstruction = `
      ${ctx.persona.getInstructions(ctx)}
      
      WRITING STRATEGY: 
      ${this.writingStrategy}
              
      CORE EXECUTION RULES:
      1. Follow the INTENT micro-brief exactly. It defines your scope boundaries.
      2. Use the PREVIOUS BRIDGE for narrative continuity.
      3. Do not repeat information or "steal" topics reserved for other sections.
    `.trim();

    const prompt = `
      INTENT: ${ctx.intent}
      
      CONTEXT:
      - Goal: ${ctx.goal}
      - Target Audience: ${ctx.audience}
      - Previous Context: ${ctx.precedingBridge || "Beginning of document"}
      - Progress: ${ctx.isFirst ? "Start" : ctx.isLast ? "Conclusion" : "In-Progress"}

      OUTPUT FORMAT:
      [CONTENT]Generated content[/CONTENT]
      [BRIDGE]Brief summary for the next agent[/BRIDGE]
    `.trim();

    const text = await AiService.execute(prompt, {
      model: modelName,
      systemInstruction,
      onRetry: ctx.onRetry,
    });

    const contentMatch = text.match(/\[CONTENT\]([\s\S]*?)\[\/CONTENT\]/i);
    const bridgeMatch = text.match(/\[BRIDGE\]([\s\S]*?)\[\/BRIDGE\]/i);

    if (!contentMatch || !bridgeMatch) {
      throw new Error(`Writer ${this.id} failed to return delimited content.`);
    }

    return {
      content: contentMatch[1].trim(),
      bridge: bridgeMatch[1].trim(),
    };
  }
}

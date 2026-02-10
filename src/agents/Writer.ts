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
      2. Do not repeat information or "steal" topics reserved for other sections.

      PROTOCOL:
      1. Provide a [CONTENT] block with markdown.
      2. Provide a [BRIDGE] block with a brief summary for the next agent.
      3. FORMATTING: You are writing a SECTION of a document. 
         - NEVER use H1 (#) or H2 (##) tags.
         - Use H3 (###) or H4 (####) for sub-sections if needed.
         - Do not repeat the section title provided in the intent.
      4. Do not repeat information reserved for other sections.

      OUTPUT FORMAT:
      [CONTENT]
      (Your markdown content here, starting directly with text)
      [/CONTENT]
      [BRIDGE]
      (Brief summary)
      [/BRIDGE]
    `.trim();

    const prompt = `
      INTENT: ${ctx.intent}
      
      CONTEXT:
      - Goal: ${ctx.goal}
      - Target Audience: ${ctx.audience}
      - Previous Context: ${ctx.precedingBridge || "Beginning of document"}
      - Progress: ${ctx.isFirst ? "Start" : ctx.isLast ? "Conclusion" : "In-Progress"}
    `.trim();

    const text = await AiService.execute(prompt, {
      model: modelName,
      systemInstruction,
      onRetry: ctx.onRetry,
    });

    const contentMatch = text.match(/\[CONTENT\]([\s\S]*?)(\[\/CONTENT\]|$)/i);
    const bridgeMatch = text.match(/\[BRIDGE\]([\s\S]*?)(\[\/BRIDGE\]|$)/i);

    if (!contentMatch || !bridgeMatch) {
      throw new Error(`Writer ${this.id} failed to return delimited content.`);
    }

    return {
      content: contentMatch[1].trim(),
      bridge: bridgeMatch[1].trim(),
    };
  }
}

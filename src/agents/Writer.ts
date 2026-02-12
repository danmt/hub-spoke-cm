// src/agents/Writer.ts
import { AiService } from "../services/AiService.js";
import { getGlobalConfig } from "../utils/config.js";

export interface WriterContext {
  intent: string;
  topic: string;
  goal: string;
  audience: string;
  bridge: string;
  isFirst: boolean;
  isLast: boolean;
  onRetry?: (error: Error) => Promise<boolean>;
}

export interface WriterResponse {
  header: string;
  content: string;
}

export class Writer {
  private readonly systemInstruction: string;

  constructor(
    public id: string,
    public description: string,
    writingStrategy: string,
  ) {
    this.systemInstruction = `
      ROLE: You are a Neutral Content Writer.
      
      WRITING STRATEGY: 
      ${writingStrategy}
              
      CORE EXECUTION RULES:
      1. Follow the INTENT micro-brief exactly. It defines your scope boundaries.
      2. Do not repeat information or "steal" topics reserved for other sections.

      PROTOCOL:
      1. Provide a [HEADER] block with a compelling H2 title for this section.
      2. Provide a [CONTENT] block with markdown.
      3. Provide a [BRIDGE] block with a brief summary for the next agent.
      4. FORMATTING: You are writing a SECTION of a document. 
         - NEVER use H1 (#) or H2 (##) tags inside the [CONTENT] block.
         - Use H3 (###) or H4 (####) for sub-sections if needed.
      5. Do not repeat information reserved for other sections.

      INPUT FORMAT:
      [INTENT]Intent of the content[/INTENT]
      [TOPIC]Topic of the content[/TOPIC]
      [GOAL]Goal of the content[/GOAL]
      [AUDIENCE]Audience of the content[/AUDIENCE]
      [BRIDGE]Brief summary of whats been covered already[/BRIDGE]
      [PROGRESS]Whether its start, in progress or conclusion[/PROGRESS]

      OUTPUT FORMAT:
      [HEADER]
      (Engaging H2 Title)
      [/HEADER]
      [CONTENT]
      (Your markdown content here, starting directly with text)
      [/CONTENT]
    `.trim();
  }

  async write(ctx: WriterContext): Promise<WriterResponse> {
    const modelName = getGlobalConfig().writerModel || "gemini-3-flash";

    const prompt = `
      [INTENT]${ctx.intent}[/INTENT]
      [TOPIC]${ctx.topic}[/TOPIC]
      [GOAL]${ctx.goal}[/GOAL]
      [AUDIENCE]${ctx.audience}[/AUDIENCE]
      [BRIDGE]${ctx.bridge}[/BRIDGE]
      [PROGRESS]${ctx.isFirst ? "Start" : ctx.isLast ? "Conclusion" : "In-Progress"}[/PROGRESS]
    `.trim();

    const text = await AiService.execute(prompt, {
      model: modelName,
      systemInstruction: this.systemInstruction,
      onRetry: ctx.onRetry,
    });

    return this.parse(text);
  }

  private parse(text: string): WriterResponse {
    const headerMatch = text.match(/\[HEADER\]([\s\S]*?)(\[\/HEADER\]|$)/i);
    const contentMatch = text.match(/\[CONTENT\]([\s\S]*?)(\[\/CONTENT\]|$)/i);

    if (!headerMatch || !contentMatch) {
      throw new Error(`Writer ${this.id} failed to return delimited content.`);
    }

    return {
      header: headerMatch[1].trim(),
      content: contentMatch[1].trim(),
    };
  }
}

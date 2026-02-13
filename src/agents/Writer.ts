// src/agents/Writer.ts
import { AiService } from "../services/AiService.js";
import { LoggerService } from "../services/LoggerService.js";
import { getGlobalConfig } from "../utils/config.js";

export type WriterInteractionResponse =
  | {
      action: "proceed";
    }
  | {
      action: "feedback";
      feedback: string;
    };

export type WriterInteractionHandler = (
  params: WriterResponse,
) => Promise<WriterInteractionResponse>;

export interface WriterContext {
  intent: string;
  topic: string;
  goal: string;
  audience: string;
  bridge: string;
  isFirst: boolean;
  isLast: boolean;
  interact?: WriterInteractionHandler;
  onThinking?: () => void;
  onRetry?: (error: Error) => Promise<boolean>;
}

export interface WriterGenerateContext {
  intent: string;
  topic: string;
  goal: string;
  audience: string;
  bridge: string;
  isFirst: boolean;
  isLast: boolean;
  feedback?: string;
}

export interface WriterResponse {
  header: string;
  content: string;
}

export class Writer {
  private readonly systemInstruction: string;
  private history: any[] = [];

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
      3. LANGUAGE POLICY: You must write EXCLUSIVELY in English. Even if the topic or goal mentions another language, you provide the technical foundation in English.

      PROTOCOL:
      1. Provide a [HEADER] block with a compelling title for this section.
        - Output clean text. Avoid markdown prefixes.
      2. Provide a [CONTENT] block with markdown.
      3. Provide a [BRIDGE] block with a brief summary for the next agent.
      4. FORMATTING: You are writing a SECTION of a document. 
         - NEVER use H1 (#) or H2 (##) tags inside the [CONTENT] block.
         - Use H3 (###) or H4 (####) for sub-sections if needed.
         - NEVER combine a blockquote (>) with a header (#, ##, ###, ####, etc...).
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
      (Title text here)
      [/HEADER]
      [CONTENT]
      (Your markdown content here, starting directly with text)
      [/CONTENT]
    `.trim();
  }

  async write(ctx: WriterContext): Promise<WriterResponse> {
    let currentFeedback: string | undefined = undefined;

    while (true) {
      try {
        if (ctx.onThinking) ctx.onThinking();

        const generated = await this.generate({
          audience: ctx.audience,
          goal: ctx.goal,
          topic: ctx.topic,
          feedback: currentFeedback,
          bridge: ctx.bridge,
          intent: ctx.intent,
          isFirst: ctx.isFirst,
          isLast: ctx.isLast,
        });

        if (!ctx.interact) {
          return generated;
        }

        const interaction = await ctx.interact(generated);

        if (interaction.action === "proceed") {
          return generated;
        }

        currentFeedback = interaction.feedback || "Continue refinement.";
      } catch (error: any) {
        if (ctx.onRetry) {
          const shouldRetry = await ctx.onRetry?.(error);

          if (shouldRetry) {
            await LoggerService.info(
              "Write retrying based on user/handler decision.",
            );
            continue;
          }
        }

        throw new Error(`Writer failed: ${error.message}`);
      }
    }
  }

  private async generate(ctx: WriterGenerateContext): Promise<WriterResponse> {
    const modelName = getGlobalConfig().writerModel || "gemini-3-flash";

    const basePrompt = `
      [INTENT]${ctx.intent}[/INTENT]
      [TOPIC]${ctx.topic}[/TOPIC]
      [GOAL]${ctx.goal}[/GOAL]
      [AUDIENCE]${ctx.audience}[/AUDIENCE]
      [BRIDGE]${ctx.bridge}[/BRIDGE]
      [PROGRESS]${ctx.isFirst ? "Start" : ctx.isLast ? "Conclusion" : "In-Progress"}[/PROGRESS]
    `;

    const prompt = ctx.feedback
      ? `${basePrompt}\n\nUSER FEEDBACK: ${ctx.feedback}`
      : basePrompt;

    const text = await AiService.execute(prompt.trim(), {
      model: modelName,
      systemInstruction: this.systemInstruction,
    });

    this.history.push(
      { role: "user", parts: [{ text: prompt }] },
      { role: "model", parts: [{ text }] },
    );

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

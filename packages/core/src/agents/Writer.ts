// packages/core/src/agents/Writer.ts
import { AiService } from "../services/AiService.js";
import { LoggerService } from "../services/LoggerService.js";
import { AgentTruth } from "../types/index.js";
import { MAX_TRUTHS_FOR_CONTEXT } from "../utils/consts.js";

export type WriterInteractionResponse =
  | { action: "proceed" }
  | { action: "feedback"; feedback: string };

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
  onThinking?: (agentId: string) => void;
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
  agentId: string;
  content: string;
}

export class Writer {
  private readonly systemInstruction: string;
  private history: any[] = [];

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    public id: string,
    public displayName: string,
    public description: string,
    behaviour: string,
    truths: AgentTruth[] = [],
  ) {
    const learnedContext = truths
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_TRUTHS_FOR_CONTEXT)
      .map((t) => `- ${t.text}`)
      .join("\n");

    this.systemInstruction = `
      ROLE: You are a Neutral Content Writer.
      
      WRITING STRATEGY: 
      ${behaviour}

      ${learnedContext ? `LEARNED CONTEXT (MANDATORY GUIDELINES):\n${learnedContext}` : ""}
              
      CORE EXECUTION RULES:
      1. Follow the INTENT micro-brief exactly. It defines your scope boundaries.
      2. Do not repeat information or "steal" topics reserved for other sections.
      3. LANGUAGE POLICY: You must write EXCLUSIVELY in English. Even if the topic or goal mentions another language, you provide the technical foundation in English.

      PROTOCOL:
      - You are generating a single, atomic block of content for a larger document.
      - Output ONLY the raw markdown text. No greetings, no explanations, no conversational filler.
      - DO NOT add a document title or section heading (like # or ##) at the top of your response. The system already handles the section headers.
      - You may use bolding, lists, code blocks, quotes if the content requires it.
      - NEVER combine a blockquote (>) with a header.

      INPUT FORMAT:
      Intent: Intent of the content
      Topic: Topic of the content
      Goal: Goal of the content
      Audience: Audience of the content
      Bridge: Brief summary of whats been covered already
      Progress: Whether its start, in progress or conclusion
    `.trim();
  }

  async write(ctx: WriterContext): Promise<WriterResponse> {
    let currentFeedback: string | undefined = undefined;

    while (true) {
      try {
        if (ctx.onThinking) ctx.onThinking(this.id);

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

        if (!ctx.interact) return generated;

        const interaction = await ctx.interact(generated);
        if (interaction.action === "proceed") return generated;

        currentFeedback = interaction.feedback || "Continue refinement.";
      } catch (error: any) {
        await LoggerService.error("Writer failed: ", {
          code: error.error?.code,
          message: error.message,
          stack: error.stack,
          writerId: this.id,
        });

        if (ctx.onRetry && (await ctx.onRetry?.(error))) {
          await LoggerService.info(
            "Write retrying based on user/handler decision.",
          );
          continue;
        }

        throw new Error(`Writer failed: ${error.message}`);
      }
    }
  }

  private async generate(ctx: WriterGenerateContext): Promise<WriterResponse> {
    const basePrompt = `
      Intent: ${ctx.intent}
      Topic: ${ctx.topic}
      Goal: ${ctx.goal}
      Audience: ${ctx.audience}
      Bridge: ${ctx.bridge}
      Progress: ${ctx.isFirst ? "Start" : ctx.isLast ? "Conclusion" : "In-Progress"}
    `;

    const prompt = ctx.feedback
      ? `${basePrompt}\n\nUSER FEEDBACK: ${ctx.feedback}`
      : basePrompt;

    const text = await AiService.execute(prompt.trim(), {
      model: this.model,
      systemInstruction: this.systemInstruction,
      apiKey: this.apiKey,
      history: this.history,
    });

    this.history.push(
      { role: "user", parts: [{ text: prompt }] },
      { role: "model", parts: [{ text }] },
    );

    return this.parse(text);
  }

  private parse(text: string): WriterResponse {
    const content = text.trim();

    if (!content) {
      throw new Error(`Writer agent "${this.id}" returned an empty response.`);
    }

    return {
      agentId: this.id,
      content,
    };
  }
}

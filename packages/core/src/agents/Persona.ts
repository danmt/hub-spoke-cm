// packages/core/src/agents/Persona.ts
import { AiService } from "../services/AiService.js";
import { LoggerService } from "../services/LoggerService.js";
import { AgentTruth } from "../types/index.js";
import { MAX_TRUTHS_FOR_CONTEXT } from "../utils/consts.js";

export type PersonaInteractionResponse =
  | { action: "proceed" }
  | { action: "feedback"; feedback: string };

export type PersonaInteractionHandler = (
  params: PersonaResponse,
) => Promise<PersonaInteractionResponse>;

export interface PersonaContext {
  content: string;
  interact?: PersonaInteractionHandler;
  onThinking?: (agentId: string) => void;
  onRetry?: (error: Error) => Promise<boolean>;
}

export interface PersonaGenerateContext {
  content: string;
  feedback?: string;
}

export interface PersonaResponse {
  agentId: string;
  content: string;
}

export class Persona {
  private readonly systemInstruction: string;
  private history: any[] = [];

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    public id: string,
    public displayName: string,
    public description: string,
    public language: string,
    public accent: string,
    public tone: string,
    behaviour: string,
    truths: AgentTruth[] = [],
  ) {
    const learnedContext = truths
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_TRUTHS_FOR_CONTEXT)
      .map((t) => `- ${t.text}`)
      .join("\n");

    this.systemInstruction = `
      ROLE:
      ${behaviour}

      VOICE & STYLE:
      - LANGUAGE: Must write exclusively in ${this.language || this.language}.
      - ACCENT: ${this.accent}
      - TONE: ${this.tone}.

      ${learnedContext ? `LEARNED CONTEXT (MANDATORY GUIDELINES):\n${learnedContext}` : ""}

      TASK:
      You are a Voice and Tone specialist. You will receive a content block to rephrase.
      Your job is to rephrase it entirely into your specific voice and tone while preserving all technical facts and meaning.

      RULES:
        1. Rewrite the content to sound exactly like you.
        2. Maintain all Markdown formatting and technical accuracy.
        3. Do not change the technical intent, only the "vibe" and phrasing.
        4. DO NOT add Markdown headings (like # or ##) unless they were present in the source text.
        5. DO NOT include any conversational filler or pleasantries. Output ONLY the rephrased content.

      INPUT FORMAT:
      Content: The neutral markdown text you need to rephrase
    `.trim();
  }

  async rephrase(ctx: PersonaContext): Promise<PersonaResponse> {
    let currentFeedback: string | undefined = undefined;

    while (true) {
      try {
        if (ctx.onThinking) ctx.onThinking(this.id);

        const generated = await this.generate({
          content: ctx.content,
          feedback: currentFeedback,
        });

        if (!ctx.interact) return generated;

        const interaction = await ctx.interact(generated);
        if (interaction.action === "proceed") return generated;

        currentFeedback = interaction.feedback;
      } catch (error: any) {
        await LoggerService.error("Persona failed: ", {
          code: error.error?.code,
          message: error.message,
          stack: error.stack,
          personaId: this.id,
        });

        if (ctx.onRetry && (await ctx.onRetry?.(error))) {
          await LoggerService.info(
            "Rephrase retrying based on user/handler decision.",
          );
          continue;
        }

        throw new Error(`Persona failed: ${error.message}`);
      }
    }
  }

  private async generate(
    ctx: PersonaGenerateContext,
  ): Promise<PersonaResponse> {
    const basePrompt = `
      Content: ${ctx.content}
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

  private parse(text: string): PersonaResponse {
    const content = text.trim();

    if (!content) {
      throw new Error(`Persona agent "${this.id}" returned an empty response.`);
    }

    return {
      agentId: this.id,
      content,
    };
  }
}

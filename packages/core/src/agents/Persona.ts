// src/agents/Persona.ts
import { AiService } from "../services/AiService.js";
import { LoggerService } from "../services/LoggerService.js";

export type PersonaInteractionResponse =
  | {
      action: "proceed";
    }
  | {
      action: "feedback";
      feedback: string;
    };

export type PersonaInteractionHandler = (
  params: PersonaResponse,
) => Promise<PersonaInteractionResponse>;

export interface PersonaContext {
  header: string;
  content: string;
  interact?: PersonaInteractionHandler;
  onThinking?: () => void;
  onRetry?: (error: Error) => Promise<boolean>;
}

export interface PersonaGenerateContext {
  header: string;
  content: string;
  feedback?: string;
}

export interface PersonaResponse {
  header: string;
  content: string;
}

export class Persona {
  private readonly systemInstruction: string;
  private history: any[] = [];

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    public id: string,
    public name: string,
    public description: string,
    public language: string,
    public accent: string,
    public tone: string,
    public roleDescription: string,
  ) {
    this.systemInstruction = `
      ROLE:
      ${this.roleDescription}

      VOICE & STYLE:
      - LANGUAGE: Must write exclusively in ${this.language || this.language}.
      - ACCENT: ${this.accent}
      - TONE: ${this.tone}.

      TASK:
      
      You are a Voice and Tone specialist. You will receive a [NEUTRAL_HEADER] and [NEUTRAL_CONTENT].
      Your job is to rephrase them entirely into your specific voice and tone while preserving all technical facts and meaning.

      RULES:

        1. Use your unique accent and tone for the header.
        2. Rewrite the content to sound exactly like you.
        3. Maintain all Markdown formatting and technical accuracy.
        4. Do not change the technical intent, only the "vibe" and phrasing.

      INPUT FORMAT:
      [NEUTRAL_HEADER]Neutral header[/NEUTRAL_HEADER]
      [NEUTRAL_CONTENT]Neutral content[/NEUTRAL_CONTENT]

      OUTPUT FORMAT:
      [HEADER]Rephrased Title[/HEADER]
      [CONTENT]
      Rephrased body content...
      [/CONTENT]
    `.trim();
  }

  async rephrase(ctx: PersonaContext): Promise<PersonaResponse> {
    let currentFeedback: string | undefined = undefined;

    while (true) {
      try {
        if (ctx.onThinking) ctx.onThinking();

        const generated = await this.generate({
          header: ctx.header,
          content: ctx.content,
          feedback: currentFeedback,
        });

        if (!ctx.interact) {
          return generated;
        }

        const interaction = await ctx.interact(generated);

        if (interaction.action === "proceed") {
          return generated;
        }

        currentFeedback = interaction.feedback;
      } catch (error: any) {
        await LoggerService.error("Persona failed: ", {
          code: error.error?.code,
          message: error.message,
          stack: error.stack,
          personaId: this.id,
        });

        if (ctx.onRetry) {
          const shouldRetry = await ctx.onRetry?.(error);

          if (shouldRetry) {
            await LoggerService.info(
              "Rephrase retrying based on user/handler decision.",
            );
            continue;
          }
        }

        throw new Error(`Persona failed: ${error.message}`);
      }
    }
  }

  private async generate(
    ctx: PersonaGenerateContext,
  ): Promise<PersonaResponse> {
    const basePrompt = `
      [NEUTRAL_HEADER]${ctx.header}[/NEUTRAL_HEADER]
      [NEUTRAL_CONTENT]
      ${ctx.content}
      [/NEUTRAL_CONTENT]
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
    const hMatch = text.match(/\[HEADER\]([\s\S]*?)\[\/HEADER\]/i);
    const cMatch = text.match(/\[CONTENT\]([\s\S]*?)\[\/CONTENT\]/i);

    if (!hMatch || !cMatch) {
      throw new Error(
        `Persona agent "${this.id}" failed to rephrase content properly.`,
      );
    }

    return {
      header: hMatch[1].trim(),
      content: cMatch[1].trim(),
    };
  }
}

// src/agents/Architect.ts
import { AiService } from "../services/AiService.js";
import { LoggerService } from "../services/LoggerService.js";
import { getGlobalConfig } from "../utils/config.js";

export type ArchitectInteractionResponse =
  | {
      action: "proceed";
    }
  | {
      action: "feedback";
      feedback: string;
    };

export type ArchitectInteractionHandler = (
  params: ArchitectResponse,
) => Promise<ArchitectInteractionResponse>;

export interface ArchitectContext {
  input?: string;
  interact?: ArchitectInteractionHandler;
  onRetry?: (err: Error) => Promise<boolean>;
  onThinking?: () => void;
}

export interface ArchitectGenerateContext {
  feedback?: string;
}

export interface ArchitectResponse {
  message: string;
  brief: Brief;
}

export interface Brief {
  topic: string;
  goal: string;
  audience: string;
  language: string;
  assemblerId: string;
  personaId: string;
}

export class Architect {
  private readonly systemInstruction: string;
  private history: any[] = [];

  constructor(manifest: string, initialContext: Partial<Brief>) {
    this.systemInstruction = `
      You are the Hub Spoke Architect. Your job is to refine a content plan.

      USER BASELINE:
      Topic: ${initialContext.topic}
      Goal: ${initialContext.goal}
      Audience: ${initialContext.audience}
      Language: ${initialContext.language}

      AVAILABLE TOOLS:
      ${manifest}

      PROTOCOL:
      1. Review the baseline. Ask follow-up questions if it's too vague.
      2. Provide a [MESSAGE] block with explanation/questions.
      3. Provide a [PROPOSAL] block with the current structured Brief.
      4. If tools are missing, explain in [MESSAGE] and propose the closest match in [PROPOSAL].
      5. The [MESSAGE] should be in the user's language.
      6. The [TOPIC], [GOAL] and [AUDIENCE] should be ALWAYS in English.

      OUTPUT FORMAT:
      [MESSAGE]Your message to the user.[/MESSAGE]
      [BRIEF]
      [TOPIC]Refined Topic[/TOPIC]
      [GOAL]Refined Goal[/GOAL]
      [AUDIENCE]Target Audience[/AUDIENCE]
      [LANGUAGE]Target Language[/LANGUAGE]
      [ASSEMBLER_ID]id[/ASSEMBLER_ID]
      [PERSONA_ID]id[/PERSONA_ID]
      [/BRIEF]
    `.trim();
  }

  async architect(ctx: ArchitectContext): Promise<ArchitectResponse> {
    let currentFeedback: string | undefined = undefined;

    while (true) {
      try {
        if (ctx.onThinking) ctx.onThinking();

        const generated = await this.generate({
          feedback: currentFeedback,
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
              "Architect retrying based on user/handler decision.",
            );
            continue;
          }
        }

        throw new Error(`Architect failed: ${error.message}`);
      }
    }
  }

  async generate(ctx: ArchitectGenerateContext): Promise<ArchitectResponse> {
    const modelName = getGlobalConfig().architectModel || "gemini-3-flash";

    const basePrompt =
      "Analyze the baseline and provide your best proposal/questions.";

    const prompt = ctx.feedback
      ? `${basePrompt}\n\nUSER FEEDBACK: ${ctx.feedback}`
      : basePrompt;

    const text = await AiService.execute(prompt.trim(), {
      model: modelName,
      systemInstruction: this.systemInstruction,
      history: this.history,
    });

    this.history.push(
      { role: "user", parts: [{ text: prompt }] },
      { role: "model", parts: [{ text }] },
    );

    return this.parse(text);
  }

  private parse(text: string): ArchitectResponse {
    const message =
      text.match(/\[MESSAGE\]([\s\S]*?)\[\/MESSAGE\]/i)?.[1].trim() || text;
    const brief = text.match(/\[BRIEF\]([\s\S]*?)\[\/BRIEF\]/i)?.[1] || "";

    return {
      message,
      brief: {
        topic: brief.match(/\[TOPIC\](.*?)\[\/TOPIC\]/i)?.[1].trim() || "",
        goal: brief.match(/\[GOAL\](.*?)\[\/GOAL\]/i)?.[1].trim() || "",
        audience:
          brief.match(/\[AUDIENCE\](.*?)\[\/AUDIENCE\]/i)?.[1].trim() || "",
        language:
          brief.match(/\[LANGUAGE\](.*?)\[\/LANGUAGE\]/i)?.[1].trim() ||
          "English",
        assemblerId:
          brief.match(/\[ASSEMBLER_ID\](.*?)\[\/ASSEMBLER_ID\]/i)?.[1].trim() ||
          "",
        personaId:
          brief.match(/\[PERSONA_ID\](.*?)\[\/PERSONA_ID\]/i)?.[1].trim() || "",
      },
    };
  }
}

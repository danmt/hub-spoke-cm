// src/agents/Architect.ts
import { AiService } from "../services/AiService.js";
import { getGlobalConfig } from "../utils/config.js";

export interface InteractionResponse {
  action: "proceed" | "feedback";
  content?: string;
}

export type InteractionHandler = (
  message: string,
  brief: Brief,
) => Promise<InteractionResponse>;

export interface ArchitectContext {
  input?: string;
  interact: InteractionHandler;
  onRetry?: (err: Error) => Promise<boolean>;
  onThinking?: () => void;
}

export interface ArchitectChatWithUserContext {
  input: string;
  onRetry?: (err: Error) => Promise<boolean>;
}

export interface ArchitectResponse {
  message: string;
  isComplete: boolean;
  brief?: Brief;
  gapFound?: boolean;
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
  private history: any[] = [];

  constructor(
    public manifest: string,
    public initialContext: Partial<Brief>,
  ) {}

  /**
   * Orchestrates the interview loop.
   * If validator is omitted, it assumes a single-pass "hope it worked" approach.
   */
  async architect(ctx: ArchitectContext): Promise<Brief | null> {
    let currentInput =
      ctx.input ||
      "Analyze the baseline and provide your best proposal/questions.";

    while (true) {
      if (ctx.onThinking) ctx.onThinking();

      const text = await this.chatWithUser({
        input: currentInput,
        onRetry: ctx.onRetry,
      });
      const message =
        text.match(/\[MESSAGE\]([\s\S]*?)\[\/MESSAGE\]/i)?.[1].trim() || text;
      const brief = this.parseBrief(
        text.match(/\[BRIEF\]([\s\S]*?)\[\/BRIEF\]/i)?.[1] || "",
      );

      // The user sees the plan and decides: proceed or give feedback
      const { action, content } = await ctx.interact(message, brief);

      if (action === "proceed") {
        return brief;
      }

      currentInput = content || "Continue refinement.";
    }
  }

  async chatWithUser(ctx: ArchitectChatWithUserContext): Promise<string> {
    try {
      const modelName = getGlobalConfig().architectModel || "gemini-3-flash";
      const systemInstruction = `
      You are the Hub Spoke Architect. Your job is to refine a content plan.

      USER BASELINE:
      Topic: ${this.initialContext.topic}
      Goal: ${this.initialContext.goal}
      Audience: ${this.initialContext.audience}
      Language: ${this.initialContext.language}

      AVAILABLE TOOLS:
      ${this.manifest}

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

      const text = await AiService.execute(ctx.input, {
        model: modelName,
        systemInstruction,
        history: this.history,
        onRetry: ctx.onRetry,
      });

      this.history.push(
        { role: "user", parts: [{ text: ctx.input }] },
        { role: "model", parts: [{ text }] },
      );

      return text;
    } catch (error: any) {
      throw new Error(`Architect failed: ${error.message}`);
    }
  }

  private parseBrief(block: string): Brief {
    return {
      topic: block.match(/\[TOPIC\](.*?)\[\/TOPIC\]/i)?.[1].trim() || "",
      goal: block.match(/\[GOAL\](.*?)\[\/GOAL\]/i)?.[1].trim() || "",
      audience:
        block.match(/\[AUDIENCE\](.*?)\[\/AUDIENCE\]/i)?.[1].trim() || "",
      language:
        block.match(/\[LANGUAGE\](.*?)\[\/LANGUAGE\]/i)?.[1].trim() ||
        "English",
      assemblerId:
        block.match(/\[ASSEMBLER_ID\](.*?)\[\/ASSEMBLER_ID\]/i)?.[1].trim() ||
        "",
      personaId:
        block.match(/\[PERSONA_ID\](.*?)\[\/PERSONA_ID\]/i)?.[1].trim() || "",
    };
  }
}

// src/agents/Architect.ts
import { AiService } from "../services/AiService.js";
import { getGlobalConfig } from "../utils/config.js";

export interface ArchitectContext {
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

  async chatWithUser(ctx: ArchitectContext): Promise<ArchitectResponse> {
    try {
      const modelName = getGlobalConfig().architectModel || "gemini-3-flash";
      const systemInstruction = `
      You are the Hub Spoke Architect. Your job is to refine a content plan.

      USER BASELINE:
      Topic: ${this.initialContext.topic}
      Goal: ${this.initialContext.goal}
      Audience: ${this.initialContext.audience}
      Language: ${this.initialContext.language}

      AVAILABLE TOOLS (ASSEMBLERS & PERSONAS):
      ${this.manifest}

      PROTOCOL:
      1. Review the baseline. Ask follow-up questions if it's too vague.
      2. If you have enough info, propose the specific Assembler and Persona and ask if the user agrees.
      3. CRITICAL: You are NOT allowed to output the [FINALIZE] tag until the user explicitly confirms (e.g., "Proceed").
      4. If requirements cannot be met, use the [GAP_DETECTED] tag.
      5. Only when confirmed, output [FINALIZE] followed by the BRIEF block.

      OUTPUT FORMAT FOR [FINALIZE]:
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

      this.history.push({ role: "user", parts: [{ text: ctx.input }] });
      this.history.push({ role: "model", parts: [{ text }] });

      if (text.includes("[GAP_DETECTED]")) {
        return {
          message: text.split("[GAP_DETECTED]")[0].trim(),
          isComplete: true,
          gapFound: true,
        };
      }

      if (text.includes("[FINALIZE]")) {
        const parts = text.split("[FINALIZE]");
        try {
          const brief: Brief = {
            topic: text.match(/\[TOPIC\](.*?)\[\/TOPIC\]/i)?.[1].trim() || "",
            goal: text.match(/\[GOAL\](.*?)\[\/GOAL\]/i)?.[1].trim() || "",
            audience:
              text.match(/\[AUDIENCE\](.*?)\[\/AUDIENCE\]/i)?.[1].trim() || "",
            language:
              text.match(/\[LANGUAGE\](.*?)\[\/LANGUAGE\]/i)?.[1].trim() ||
              "English",
            assemblerId:
              text
                .match(/\[ASSEMBLER_ID\](.*?)\[\/ASSEMBLER_ID\]/i)?.[1]
                .trim() || "",
            personaId:
              text.match(/\[PERSONA_ID\](.*?)\[\/PERSONA_ID\]/i)?.[1].trim() ||
              "",
          };
          return { message: parts[0].trim(), isComplete: true, brief };
        } catch (e) {
          return {
            message: "Brief format error. Please say 'Proceed' again.",
            isComplete: false,
          };
        }
      }

      return { message: text, isComplete: false };
    } catch (error) {
      throw new Error(
        `Architect failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

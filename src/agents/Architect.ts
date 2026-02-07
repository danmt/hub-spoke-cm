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
      1. Review the baseline. If it's too vague to produce high-quality content, ask follow-up questions.
      2. If you have enough info, propose the specific Assembler and Persona from the AVAILABLE TOOLS and ask if the user agrees.
      3. **CRITICAL**: You are NOT allowed to output the [FINALIZE] tag until the user explicitly says "Proceed", "Apply", "Yes", or "Sounds good".
      4. If the user's requirements cannot be met by available tools, use the [GAP_DETECTED] tag and explain why.
      5. Only when the user confirms, output [FINALIZE] followed by a RAW JSON object matching the BRIEF SCHEMA.

      BRIEF SCHEMA:
      {
        "topic": "The final refined topic",
        "goal": "The final refined goal",
        "audience": "Target audience",
        "language": "Target language",
        "assemblerId": "The ID of the chosen assembler",
        "personaId": "The ID of the chosen persona"
      }
    `.trim();

      // Use AiService instead of internal client
      const text = await AiService.execute(ctx.input, {
        model: modelName,
        systemInstruction,
        history: this.history, // Pass history to maintain state
        onRetry: ctx.onRetry,
      });

      // Update history for the next turn
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
          const rawJson = parts[1].replace(/```json|```/g, "").trim();
          const brief = JSON.parse(rawJson) as Brief;
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

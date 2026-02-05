import { GoogleGenAI } from "@google/genai";
import { getGlobalConfig } from "../../utils/config.js";

export interface Brief {
  topic: string;
  goal: string;
  audience: string;
  language: string;
  assemblerId: string;
  personaId: string;
}

export class ArchitectAgent {
  private modelName: string;
  private systemInstruction: string;
  private history: any[] = [];

  constructor(
    private client: GoogleGenAI,
    manifest: string,
    initialContext: Partial<Brief>,
  ) {
    this.modelName = getGlobalConfig().architectModel || "gemini-3-flash";

    this.systemInstruction = `
      You are the Hub Spoke Architect. Your job is to refine a content plan.
      
      USER BASELINE:
      Topic: ${initialContext.topic}
      Goal: ${initialContext.goal}
      Audience: ${initialContext.audience}
      Language: ${initialContext.language}

      AVAILABLE TOOLS (ASSEMBLERS & PERSONAS):
      ${manifest}

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
    `;
  }

  async chatWithUser(input: string): Promise<{
    message: string;
    isComplete: boolean;
    brief?: Brief;
    gapFound?: boolean;
  }> {
    this.history.push({ role: "user", parts: [{ text: input }] });

    try {
      const result = await this.client.models.generateContent({
        model: this.modelName,
        config: {
          systemInstruction: { parts: [{ text: this.systemInstruction }] },
        },
        contents: this.history,
      });

      const text = result.text ?? "";
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

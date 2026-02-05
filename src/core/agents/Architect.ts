// src/core/agents/Architect.ts
import { GoogleGenAI } from "@google/genai";
import { getGlobalConfig } from "../../utils/config.js";
import { getAvailableToolsManifest } from "../registry.js";

/**
 * Brief interface defines the flat structure required for
 * scaffolding the Hub and Spoke content.
 */
export interface Brief {
  topic: string;
  goal: string;
  audience: string;
  language: string;
  assemblerId: string;
  personaId: string;
}

/**
 * The ArchitectAgent handles the discovery phase, interviewing the user
 * to ensure a high-quality content plan before scaffolding.
 */
export class ArchitectAgent {
  private client: GoogleGenAI;
  private modelName: string;
  private systemInstruction: string;
  private history: any[] = [];

  constructor(apiKey: string, initialContext: Partial<Brief>) {
    this.client = new GoogleGenAI({ apiKey });
    const manifest = getAvailableToolsManifest();
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

      BRIEF SCHEMA (Strictly follow this flat JSON structure):
      {
        "topic": "The final refined topic",
        "goal": "The final refined goal",
        "audience": "Target audience",
        "language": "Target language",
        "assemblerId": "The ID of the chosen assembler",
        "personaId": "The ID of the chosen persona"
      }

      Do NOT nest properties inside 'baseline' or 'metadata' objects. Use the keys above.
    `;
  }

  /**
   * Manages the conversation loop with the user.
   */
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

      // Handle Tool Gap detection
      if (text.includes("[GAP_DETECTED]")) {
        return {
          message: text.split("[GAP_DETECTED]")[0].trim(),
          isComplete: true,
          gapFound: true,
        };
      }

      // Handle Finalization
      if (text.includes("[FINALIZE]")) {
        const parts = text.split("[FINALIZE]");
        try {
          // Clean markdown formatting if the AI ignores "raw JSON" instruction
          const rawJson = parts[1].replace(/```json|```/g, "").trim();
          const brief = JSON.parse(rawJson) as Brief;

          return {
            message: parts[0].trim(),
            isComplete: true,
            brief,
          };
        } catch (e) {
          return {
            message:
              "I encountered a formatting error in the brief. Could you please say 'Proceed' one more time?",
            isComplete: false,
          };
        }
      }

      return { message: text, isComplete: false };
    } catch (error) {
      throw new Error(
        `Architect communication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Specifically for spawning spokes. It assumes the Persona is fixed
 * and focuses purely on structural assembly.
 */
export async function planSpoke(
  apiKey: string,
  hubMetadata: any,
  spokeTopic: string,
): Promise<Brief> {
  const architect = new ArchitectAgent(apiKey, {
    topic: spokeTopic,
    language: hubMetadata.language,
    personaId: hubMetadata.personaId,
    audience: hubMetadata.audience,
    goal: `Deep dive into ${spokeTopic} as part of the ${hubMetadata.title} hub.`,
  });

  // We skip the interview for speed, or you can wrap it in a chat loop
  // similar to 'new' if you want a back-and-forth.
  const { brief } = await architect.chatWithUser(
    `Create a plan for a Spoke article about "${spokeTopic}". Use the ${hubMetadata.assemblerId || "tutorial"} assembler.`,
  );

  if (!brief) throw new Error("Architect failed to generate a Spoke brief.");
  return brief;
}

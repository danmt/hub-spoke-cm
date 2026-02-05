import { GoogleGenAI } from "@google/genai";
import { getGlobalConfig } from "../../utils/config.js";
import { PERSONA_REGISTRY } from "../personas/index.js";

export interface WriterContext {
  header: string;
  intent: string;
  topic: string;
  goal: string;
  audience: string;
  language: string;
  personaId: string;
}

export interface Writer {
  id: string;
  write(ctx: WriterContext): Promise<string>;
}

/**
 * Base abstract class for Writer Agents.
 * Centralizes SDK instantiation and core prompt logic.
 */
export abstract class BaseWriter implements Writer {
  abstract id: string;
  /**
   * The high-level strategy for this specific writer type (e.g., code vs prose).
   */
  abstract writingStrategy: string;
  protected client: GoogleGenAI;

  constructor() {
    const config = getGlobalConfig();
    // Maintain the client instance in the class
    this.client = new GoogleGenAI({ apiKey: config.apiKey! });
  }

  async write(ctx: WriterContext): Promise<string> {
    const config = getGlobalConfig();
    const persona =
      PERSONA_REGISTRY[ctx.personaId] || PERSONA_REGISTRY["standard"];
    const modelName = config.writerModel || "gemini-2.0-flash";

    const result = await this.client.models.generateContent({
      model: modelName,
      config: {
        systemInstruction: {
          parts: [
            {
              text: `${persona.getInstructions(ctx)}\n\nWRITING STRATEGY: ${this.writingStrategy}`,
            },
          ],
        },
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
                SECTION HEADER: ${ctx.header}
                INTENT: ${ctx.intent}
                TOPIC: ${ctx.topic}
                GOAL: ${ctx.goal}
                AUDIENCE: ${ctx.audience}
                
                TASK: Generate the content for this section. 
                Do NOT include the header in your response. 
                Use valid Markdown.
              `.trim(),
            },
          ],
        },
      ],
    });

    const text = result.text ?? "";
    if (!text)
      throw new Error(
        `${this.constructor.name}: Empty response for ${ctx.header}`,
      );

    return text.trim();
  }
}

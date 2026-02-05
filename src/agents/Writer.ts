import { GoogleGenAI } from "@google/genai";
import { GlobalConfig } from "../utils/config.js";
import { Persona } from "./Persona.js";

export interface WriterContext {
  header: string;
  intent: string;
  topic: string;
  goal: string;
  audience: string;
  language: string;
  persona: Persona;
}

export interface IWriter {
  id: string;
  description: string;
  writingStrategy: string;
  write(ctx: WriterContext): Promise<string>;
}

export class Writer implements IWriter {
  constructor(
    protected client: GoogleGenAI,
    protected config: GlobalConfig,
    public id: string,
    public description: string,
    public writingStrategy: string,
  ) {}

  async write(ctx: WriterContext): Promise<string> {
    const modelName = this.config.writerModel || "gemini-2.0-flash";

    const result = await this.client.models.generateContent({
      model: modelName,
      config: {
        systemInstruction: {
          parts: [
            {
              text: `${ctx.persona.getInstructions(ctx)}\n\nWRITING STRATEGY: ${this.writingStrategy}`,
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

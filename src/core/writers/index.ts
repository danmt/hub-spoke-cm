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

export class ProseWriter implements Writer {
  id = "prose";

  async write(ctx: WriterContext): Promise<string> {
    const config = getGlobalConfig();
    const persona =
      PERSONA_REGISTRY[ctx.personaId] || PERSONA_REGISTRY["standard"];

    // Correct Instantiation for @google/genai v1.40.0
    const client = new GoogleGenAI({ apiKey: config.apiKey! });

    const result = await client.models.generateContent({
      model: config.writerModel || "gemini-2.0-flash-exp",
      config: {
        systemInstruction: {
          parts: [{ text: persona.getInstructions(ctx) }],
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
            LANGUAGE: ${ctx.language}
            
            TASK: Write the prose content for this section. 
            Do NOT include the header. Use Markdown. Focus on clarity and flow.
          `.trim(),
            },
          ],
        },
      ],
    });

    // .text is a 'get' accessor property in this SDK version
    const text = result.text ?? "";
    if (!text) throw new Error(`ProseWriter: Empty response for ${ctx.header}`);

    return text.trim();
  }
}

export class CodeWriter implements Writer {
  id = "code";

  async write(ctx: WriterContext): Promise<string> {
    const config = getGlobalConfig();
    const persona =
      PERSONA_REGISTRY[ctx.personaId] || PERSONA_REGISTRY["standard"];

    const client = new GoogleGenAI({ apiKey: config.apiKey! });

    const result = await client.models.generateContent({
      model: config.writerModel || "gemini-3-flash",
      config: {
        systemInstruction: {
          parts: [{ text: persona.getInstructions(ctx) }],
        },
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
            TECHNICAL SECTION: ${ctx.header}
            GOAL: ${ctx.intent}
            TOPIC: ${ctx.topic}
            LANGUAGE: ${ctx.language}
            
            TASK: Provide the technical implementation and code blocks.
            Ensure comments are in ${ctx.language}. Use proper markdown syntax.
          `.trim(),
            },
          ],
        },
      ],
    });

    const text = result.text ?? "";
    if (!text) throw new Error(`CodeWriter: Empty response for ${ctx.header}`);

    return text.trim();
  }
}

export const WRITER_REGISTRY: Record<string, Writer> = {
  prose: new ProseWriter(),
  code: new CodeWriter(),
};

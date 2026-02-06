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
  precedingBridge?: string;
  upcomingIntents?: string[];
  isFirst: boolean;
  isLast: boolean;
}

export interface WriterResponse {
  content: string;
  bridge: string;
}

export interface IWriter {
  id: string;
  description: string;
  writingStrategy: string;
  write(ctx: WriterContext): Promise<WriterResponse>;
}

export class Writer implements IWriter {
  constructor(
    protected client: GoogleGenAI,
    protected config: GlobalConfig,
    public id: string,
    public description: string,
    public writingStrategy: string,
  ) {}

  async write(ctx: WriterContext): Promise<WriterResponse> {
    const modelName = this.config.writerModel || "gemini-2.0-flash";

    const contextPrompt = `
      PROGRESS CONTEXT:
      ${ctx.isFirst ? "- This is the START of the article." : ""}
      ${ctx.isLast ? "- This is the CONCLUSION of the article." : ""}
      ${ctx.precedingBridge ? `- PREVIOUSLY ESTABLISHED: ${ctx.precedingBridge}` : ""}
      ${ctx.upcomingIntents?.length ? `- REMAINING TOPICS TO BE COVERED: ${ctx.upcomingIntents.join(", ")}` : ""}
    `.trim();

    const result = await this.client.models.generateContent({
      model: modelName,
      config: {
        systemInstruction: {
          parts: [
            {
              text: `${ctx.persona.getInstructions(ctx)}\n\nWRITING STRATEGY: ${this.writingStrategy}
              
              TASK GUIDELINES:
              1. Generate the section content based on the INTENT.
              2. Maintain flow by acknowledging the PREVIOUSLY ESTABLISHED context without repeating it.
              3. Do NOT "steal" content from the REMAINING TOPICS.
              4. Provide a "BRIDGE": A short summary of what you wrote to help the next writer maintain continuity.`,
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
                ${contextPrompt}

                OUTPUT FORMAT (JSON ONLY):
                {
                  "content": "The markdown content (omit the H2 header)",
                  "bridge": "Context for the next agent"
                }
              `.trim(),
            },
          ],
        },
      ],
    });

    const rawJson = (result.text ?? "").replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(rawJson) as WriterResponse;
    } catch (e) {
      throw new Error(
        `Writer ${this.id} failed to return valid JSON: ${result.text}`,
      );
    }
  }
}

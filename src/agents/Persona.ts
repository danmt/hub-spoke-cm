// src/agents/Persona.ts
import { AiService } from "../services/AiService.js";
import { getGlobalConfig } from "../utils/config.js";

export interface PersonaContext {
  goal: string;
  audience: string;
  topic: string;
  language: string;
}

export interface RephraseResponse {
  header: string;
  content: string;
}

export class Persona {
  private readonly systemInstruction: string;

  constructor(
    public id: string,
    public name: string,
    public description: string,
    public language: string,
    public accent: string,
    public tone: string,
    public roleDescription: string,
  ) {
    this.systemInstruction = `
      ROLE:
      ${this.roleDescription}

      VOICE & STYLE:
      - LANGUAGE: Must write exclusively in ${this.language || this.language}.
      - ACCENT: ${this.accent}
      - TONE: ${this.tone}.

      TASK:
      
      You are a Voice and Tone specialist. You will receive a [NEUTRAL_HEADER] and [NEUTRAL_CONTENT].
      Your job is to rephrase them entirely into your specific voice and tone while preserving all technical facts and meaning.

      RULES:

        1. Use your unique accent and tone for the header.
        2. Rewrite the content to sound exactly like you.
        3. Maintain all Markdown formatting and technical accuracy.
        4. Do not change the technical intent, only the "vibe" and phrasing.

      INPUT FORMAT:
      [NEUTRAL_HEADER]Neutral header[/NEUTRAL_HEADER]
      [NEUTRAL_CONTENT]Neutral content[/NEUTRAL_CONTENT]

      OUTPUT FORMAT:
      [HEADER]Rephrased Title[/HEADER]
      [CONTENT]
      Rephrased body content...
      [/CONTENT]
    `.trim();
  }

  /**
   * Action: Rephrase neutral content into the Persona's voice.
   */
  async rephrase(
    header: string,
    content: string,
    ctx: PersonaContext,
    onRetry?: (err: Error) => Promise<boolean>,
  ): Promise<RephraseResponse> {
    const modelName = getGlobalConfig().architectModel || "gemini-2-flash";

    const prompt = `
      CONTEXT:
        Subject: "${ctx.topic}"
        Goal: "${ctx.goal}"
        Target Audience: "${ctx.audience}"
        
      [NEUTRAL_HEADER]${header}[/NEUTRAL_HEADER]
      [NEUTRAL_CONTENT]
      ${content}
      [/NEUTRAL_CONTENT]
    `.trim();

    const text = await AiService.execute(prompt, {
      model: modelName,
      systemInstruction: this.systemInstruction,
      onRetry,
    });

    const hMatch = text.match(/\[HEADER\]([\s\S]*?)\[\/HEADER\]/i);
    const cMatch = text.match(/\[CONTENT\]([\s\S]*?)\[\/CONTENT\]/i);

    if (!hMatch || !cMatch) {
      throw new Error(
        `Persona agent "${this.id}" failed to rephrase content properly.`,
      );
    }

    return {
      header: hMatch[1].trim(),
      content: cMatch[1].trim(),
    };
  }
}

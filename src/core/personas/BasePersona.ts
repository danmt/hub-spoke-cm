export interface PersonaContext {
  goal: string;
  audience: string;
  topic: string;
  language: string;
}

/**
 * Base abstract class for all Personas.
 * Centralizes prompt generation and structural influence.
 */
export abstract class BasePersona {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract language: string;
  abstract accent: string;
  abstract tone: string;
  abstract roleDescription: string;

  /**
   * Generates the system instructions for the Writer agents.
   */
  getInstructions(ctx: PersonaContext): string {
    return `
      ROLE:
      ${this.roleDescription}

      VOICE & STYLE:
      - LANGUAGE: Must write exclusively in ${ctx.language || this.language}.
      - ACCENT: ${this.accent}
      - TONE: ${this.tone}.

      CONTEXT:
      Subject: "${ctx.topic}"
      Goal: "${ctx.goal}"
      Target Audience: "${ctx.audience}"
    `.trim();
  }
}

export interface PersonaContext {
  goal: string;
  audience: string;
  topic: string;
  language: string;
}

export interface IPersona {
  id: string;
  name: string;
  description: string;
  language: string;
  accent: string;
  tone: string;
  roleDescription: string;
  getInstructions(ctx: PersonaContext): string;
}

export class Persona implements IPersona {
  constructor(
    public id: string,
    public name: string,
    public description: string,
    public language: string,
    public accent: string,
    public tone: string,
    public roleDescription: string,
  ) {}

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

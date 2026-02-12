// src/agents/Assembler.ts
import { AiService } from "../services/AiService.js";
import { HubBlueprint } from "../types/index.js";
import { getGlobalConfig } from "../utils/config.js";

export interface AssemblerContext {
  topic: string;
  goal: string;
  audience: string;
  feedback?: string;
  onRetry?: (error: Error) => Promise<boolean>;
  validator?: (
    blueprint: HubBlueprint,
  ) => Promise<{ confirmed: boolean; feedback?: string }>;
}

export interface AssemblerResponse {
  strategyPrompt: string;
  blueprint: HubBlueprint;
}

export class Assembler {
  constructor(
    public id: string,
    public description: string,
    public strategyPrompt: string,
    public writerIds: string[],
  ) {
    if (writerIds.length === 0) {
      throw new Error(`Assembler "${id}" has an empty list of writers.`);
    }
  }

  async assemble(ctx: AssemblerContext): Promise<AssemblerResponse> {
    let feedback: string | undefined;
    const runValidator =
      ctx.validator || (async () => ({ confirmed: true, feedback: undefined }));

    while (true) {
      const response = await this.generate(ctx);

      const { confirmed, feedback: nextFeedback } = await runValidator(
        response.blueprint,
      );

      if (confirmed) {
        return response;
      }

      feedback =
        nextFeedback ||
        "The previous structure was rejected. Please try a different decomposition.";
    }
  }

  async generate(ctx: AssemblerContext): Promise<AssemblerResponse> {
    const model = getGlobalConfig().architectModel || "gemini-3-flash";
    const writerConstraint = this.writerIds.join("|");

    const systemInstruction = `
      You are a Lead Content Architect. Your mission is to decompose a high-level project into a surgical, sequential execution blueprint.

      PROJECT CONTEXT:
      - TOPIC: "${ctx.topic}"
      - GOAL: "${ctx.goal}"
      - AUDIENCE: "${ctx.audience}"
      
      STRATEGY: ${this.strategyPrompt}

      ${ctx.feedback ? `CRITICAL - USER FEEDBACK ON PREVIOUS ATTEMPT: ${ctx.feedback}` : ""}
      
      CRITICAL REQUIREMENT: "FUTURE-AWARE INTENTS"
      Every section's 'intent' must be a detailed micro-brief (50-100 words) that includes:
      1. PRIMARY FOCUS: The specific technical or narrative goal of THIS section.
      2. SCOPE BOUNDARY: Explicitly list what NOT to mention because it belongs in a later section.
      3. THE HAND-OFF: How this section should end to prime the reader for the next specific header.

      EXECUTION RULES:
      1. WRITER SELECTION: Select exactly ONE Writer ID from: [${writerConstraint}]. Choose the writer that best fits the specific nature of that section.
      2. LANGUAGE ENFORCEMENT: Write the blueprint 'header' and 'intent' blocks in English for clarity.

      OUTPUT FORMAT (Use these exact delimiters):
      [HUB_ID]slugified-topic-id[/HUB_ID]
      
      [COMPONENT]
      [ID]unique-section-id[/ID]
      [HEADER]Section Title[/HEADER]
      [INTENT]Detailed micro-brief focusing on ${ctx.topic} for ${ctx.audience}...[/INTENT]
      [WRITER_ID]${writerConstraint}[/WRITER_ID]
      [/COMPONENT]
    `.trim();

    const text = await AiService.execute(systemInstruction, {
      model,
      onRetry: ctx.onRetry,
    });

    return {
      blueprint: this.parseDelimiterResponse(text),
      strategyPrompt: this.strategyPrompt,
    };
  }

  private parseDelimiterResponse(text: string): HubBlueprint {
    const hubIdMatch = text.match(/\[HUB_ID\](.*?)\[\/HUB_ID\]/i);
    const hubId = hubIdMatch ? hubIdMatch[1].trim() : "generated-hub";

    const componentRegex = /\[COMPONENT\]([\s\S]*?)\[\/COMPONENT\]/gi;
    const components = [];
    let match;

    while ((match = componentRegex.exec(text)) !== null) {
      const block = match[1];
      const id = block.match(/\[ID\]([\s\S]*?)\[\/ID\]/i)?.[1].trim();
      const header = block.match(/\[HEADER\](.*?)\[\/HEADER\]/i)?.[1].trim();
      const intent = block
        .match(/\[INTENT\]([\s\S]*?)\[\/INTENT\]/i)?.[1]
        .trim();
      const writerId = block
        .match(/\[WRITER_ID\](.*?)\[\/WRITER_ID\]/i)?.[1]
        .trim();

      if (!id || !header || !intent || !writerId) {
        throw new Error("Assembler failed to produce a valid [COMPONENT].");
      }

      components.push({
        id,
        header,
        intent,
        writerId,
      });
    }

    if (components.length === 0) {
      throw new Error(
        "Assembler failed to produce any valid [COMPONENT] blocks.",
      );
    }

    return { hubId, components };
  }
}

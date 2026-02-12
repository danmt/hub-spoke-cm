// src/agents/Assembler.ts
import { AiService } from "../services/AiService.js";
import { HubBlueprint } from "../types/index.js";
import { getGlobalConfig } from "../utils/config.js";

export type AssemblerInteractionResponse =
  | {
      action: "proceed";
    }
  | {
      action: "feedback";
      feedback: string;
    };

export interface AssemblerInteractionHandlerParams {
  blueprint: HubBlueprint;
}

export type AssemblerInteractionHandler = (
  params: AssemblerInteractionHandlerParams,
) => Promise<AssemblerInteractionResponse>;

export interface AssembleContext {
  topic: string;
  goal: string;
  audience: string;
  input?: string;
  interact: AssemblerInteractionHandler;
  onRetry?: (error: Error) => Promise<boolean>;
  onThinking?: () => void;
}

export interface AssembleResponse {
  blueprint: HubBlueprint;
}

export interface AssemblerGenerateContext {
  topic: string;
  goal: string;
  audience: string;
  input?: string;
  onRetry?: (error: Error) => Promise<boolean>;
}

export interface AssemblerGenerateResponse {
  blueprint: HubBlueprint;
}

export class Assembler {
  private readonly systemInstruction: string;

  constructor(
    public id: string,
    public description: string,
    public strategyPrompt: string,
    writerIds: string[],
  ) {
    if (writerIds.length === 0) {
      throw new Error(`Assembler "${id}" has an empty list of writers.`);
    }

    const writerConstraint = writerIds.join("|");

    this.systemInstruction = `
      You are a Lead Content Architect. Your mission is to decompose a high-level project into a surgical, sequential execution blueprint.

      STRATEGY: ${this.strategyPrompt}

      CRITICAL REQUIREMENT: "FUTURE-AWARE INTENTS"
      Every section's 'intent' must be a detailed micro-brief (50-100 words) that includes:
      1. PRIMARY FOCUS: The specific technical or narrative goal of THIS section.
      2. SCOPE BOUNDARY: Explicitly list what NOT to mention because it belongs in a later section.
      3. THE HAND-OFF: How this section should end to prime the reader for the next specific header.

      CRITICAL REQUIREMENT: "NARRATIVE CONNECTIVITY"
      For every component, you must define a [BRIDGE]. 
      This is one paragraph instruction for the writer on how to transition into the current section. 
      It must mentions all the concepts that have been covered so far.

      EXECUTION RULES:
      1. WRITER SELECTION: Select exactly ONE Writer ID from: [${writerConstraint}]. Choose the writer that best fits the specific nature of that section.
      2. LANGUAGE ENFORCEMENT: Write the blueprint 'header' and 'intent' blocks in English for clarity.

      INPUT FORMAT:
      [TOPIC]Topic of the blueprint[/TOPIC]
      [GOAL]Goal of the blueprint[/GOAL]
      [AUDIENCE]Audience of the blueprint[/AUDIENCE]

      OUTPUT FORMAT (Use these exact delimiters):
      [HUB_ID]slugified-topic-id[/HUB_ID]
      
      [COMPONENT]
      [ID]unique-section-id[/ID]
      [HEADER]Section Title[/HEADER]
      [INTENT]Detailed micro-brief focusing on the [TOPIC] for the [AUDIENCE][/INTENT]
      [WRITER_ID]prose, code or custom writer IDs[/WRITER_ID]
      [BRIDGE]Context of the concepts already covered so far[/BRIDGE]
      [/COMPONENT]
    `.trim();
  }

  async assemble(ctx: AssembleContext): Promise<AssembleResponse> {
    let currentInput =
      ctx.input || "Analyze the baseline and provide your best proposal.";

    while (true) {
      if (ctx.onThinking) ctx.onThinking();

      const generated = await this.generate({
        audience: ctx.audience,
        goal: ctx.goal,
        topic: ctx.topic,
        input: currentInput,
        onRetry: ctx.onRetry,
      });

      const interaction = await ctx.interact(generated);

      if (interaction.action === "proceed") {
        return generated;
      }

      currentInput = interaction.feedback || "Continue refinement.";
    }
  }

  async generate(
    ctx: AssemblerGenerateContext,
  ): Promise<AssemblerGenerateResponse> {
    const model = getGlobalConfig().architectModel || "gemini-3-flash";

    const prompt = `
      [TOPIC]${ctx.topic}[/TOPIC]
      [GOAL]${ctx.goal}[/GOAL]
      [AUDIENCE]${ctx.audience}[/AUDIENCE]
      
      ${ctx.input ? `CRITICAL - USER FEEDBACK ON PREVIOUS ATTEMPT: ${ctx.input}` : ""}
    `.trim();

    const text = await AiService.execute(prompt, {
      model,
      systemInstruction: this.systemInstruction,
      onRetry: ctx.onRetry,
    });

    return this.parse(text);
  }

  private parse(text: string): AssembleResponse {
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
      const bridge = block.match(/\[BRIDGE\](.*?)\[\/BRIDGE\]/i)?.[1].trim();

      if (!id || !header || !intent || !writerId || !bridge) {
        throw new Error("Assembler failed to produce a valid [COMPONENT].");
      }

      components.push({
        id,
        header,
        intent,
        writerId,
        bridge,
      });
    }

    if (components.length === 0) {
      throw new Error(
        "Assembler failed to produce any valid [COMPONENT] blocks.",
      );
    }

    return { blueprint: { hubId, components } };
  }
}

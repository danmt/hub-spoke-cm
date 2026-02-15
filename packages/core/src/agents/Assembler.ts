// src/agents/Assembler.ts
import { AiService } from "../services/AiService.js";
import { LoggerService } from "../services/LoggerService.js";
import { HubBlueprint } from "../types/index.js";
import { extractTag } from "../utils/extractTag.js";

export type AssemblerInteractionResponse =
  | {
      action: "proceed";
    }
  | {
      action: "feedback";
      feedback: string;
    };

export type AssemblerInteractionHandler = (
  params: AssembleResponse,
) => Promise<AssemblerInteractionResponse>;

export interface AssembleContext {
  topic: string;
  goal: string;
  audience: string;
  interact?: AssemblerInteractionHandler;
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
  feedback?: string;
}

export interface AssemblerGenerateResponse {
  blueprint: HubBlueprint;
}

export class Assembler {
  private readonly systemInstruction: string;
  private history: any[] = [];

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    public id: string,
    public description: string,
    strategyPrompt: string,
    writerIds: string[],
  ) {
    if (writerIds.length === 0) {
      throw new Error(`Assembler "${id}" has an empty list of writers.`);
    }

    const writerConstraint = writerIds.join("|");

    this.systemInstruction = `
      You are a Lead Content Architect. Your mission is to decompose a high-level project into a surgical, sequential execution blueprint.

      STRATEGY: ${strategyPrompt}

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

      Remember: Every [COMPONENT] must include [ID], [HEADER], [INTENT], [WRITER_ID], and [BRIDGE] tags. Always include a closing tag.
    `.trim();
  }

  async assemble(ctx: AssembleContext): Promise<AssembleResponse> {
    let currentFeedback: string | undefined = undefined;

    while (true) {
      try {
        if (ctx.onThinking) ctx.onThinking();

        const generated = await this.generate({
          audience: ctx.audience,
          goal: ctx.goal,
          topic: ctx.topic,
          feedback: currentFeedback,
        });

        if (!ctx.interact) {
          return generated;
        }

        const interaction = await ctx.interact(generated);

        if (interaction.action === "proceed") {
          return generated;
        }

        currentFeedback = interaction.feedback || "Continue refinement.";
      } catch (error: any) {
        await LoggerService.error("Assembler failed: ", {
          code: error.error?.code,
          message: error.message,
          stack: error.stack,
          assemblerId: this.id,
        });

        if (ctx.onRetry) {
          const shouldRetry = await ctx.onRetry?.(error);

          if (shouldRetry) {
            await LoggerService.info(
              "Assemble retrying based on user/handler decision.",
            );
            continue;
          }
        }

        throw new Error(`Assembler failed: ${error.message}`);
      }
    }
  }

  async generate(
    ctx: AssemblerGenerateContext,
  ): Promise<AssemblerGenerateResponse> {
    const basePrompt = `
        [TOPIC]${ctx.topic}[/TOPIC]
        [GOAL]${ctx.goal}[/GOAL]
        [AUDIENCE]${ctx.audience}[/AUDIENCE]
      `;

    const prompt = ctx.feedback
      ? `${basePrompt}\n\nUSER FEEDBACK: ${ctx.feedback}`
      : basePrompt;

    const text = await AiService.execute(prompt.trim(), {
      model: this.model,
      systemInstruction: this.systemInstruction,
      history: this.history,
      apiKey: this.apiKey,
    });

    this.history.push(
      { role: "user", parts: [{ text: prompt }] },
      { role: "model", parts: [{ text }] },
    );

    return this.parse(text);
  }

  private parse(text: string): AssembleResponse {
    const hubIdMatch = text.match(/\[HUB_ID\]([\s\S]*?)\[\/HUB_ID\]/i);
    const hubId = hubIdMatch ? hubIdMatch[1].trim() : "generated-hub";

    const componentRegex = /\[COMPONENT\]([\s\S]*?)\[\/COMPONENT\]/gi;
    const components = [];
    let match;

    while ((match = componentRegex.exec(text)) !== null) {
      const block = match[1].trim();

      const id = extractTag(block, "ID");
      const header = extractTag(block, "HEADER");
      const intent = extractTag(block, "INTENT");
      const writerId = extractTag(block, "WRITER_ID");
      const bridge = extractTag(block, "BRIDGE");

      console.log(`\n${block}`);

      const missing = [];
      if (!id) missing.push("ID");
      if (!header) missing.push("HEADER");
      if (!intent) missing.push("INTENT");
      if (!writerId) missing.push("WRITER_ID");
      if (!bridge) missing.push("BRIDGE");

      if (missing.length > 0) {
        throw new Error(
          `Assembler failed to produce a valid [COMPONENT]. Missing tags: [${missing.join(", ")}] in block: ${block.substring(0, 50)}...`,
        );
      }

      components.push({
        id: id!,
        header: header!,
        intent: intent!,
        writerId: writerId!,
        bridge: bridge!,
      });
    }

    if (components.length === 0) {
      throw new Error(
        "Assembler failed to produce any valid [COMPONENT] blocks. Check if AI output follows [COMPONENT]...[/COMPONENT] format.",
      );
    }

    return { blueprint: { hubId, components } };
  }
}

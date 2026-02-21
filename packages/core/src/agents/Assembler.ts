// packages/core/src/agents/Assembler.ts
import { AiService } from "../services/AiService.js";
import { LoggerService } from "../services/LoggerService.js";
import { AgentTruth } from "../types/index.js";
import { MAX_TRUTHS_FOR_CONTEXT } from "../utils/consts.js";

export type AssemblerInteractionResponse =
  | { action: "proceed" }
  | { action: "feedback"; feedback: string };

export interface OutlineSection {
  id: string;
  header: string;
  level: number;
  intent: string;
  bridge: string;
  assemblerId: string;
  writerId: string;
}

export interface BlockTask {
  id: string;
  intent: string;
  writerId: string;
}

export interface AssembleOutlineResponse {
  agentId: string;
  sections: OutlineSection[];
}

export interface AssembleBlocksResponse {
  agentId: string;
  blocks: BlockTask[];
}

export interface AgentInfo {
  id: string;
  description: string;
}

// Strictly "outline" or "block" - no hybrid allowed
export type AssemblerRole = "outline" | "block";

export class Assembler {
  private history: any[] = [];
  private learnedContext: string;
  private readonly systemInstruction: string;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    public id: string,
    public displayName: string,
    public description: string,
    private readonly behaviour: string,
    truths: AgentTruth[] = [],
    public role: AssemblerRole,
  ) {
    this.learnedContext = truths
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_TRUTHS_FOR_CONTEXT)
      .map((t) => `- ${t.text}`)
      .join("\n");

    // The system instruction is permanently forged at construction based on the role
    if (this.role === "outline") {
      this.systemInstruction = `
        You are a Lead Content Architect. Your mission is to define the MACRO structure of a document.
        OUTLINE STRATEGY: ${this.behaviour}
        ${this.learnedContext ? `LEARNED CONTEXT:\n${this.learnedContext}` : ""}

        CRITICAL REQUIREMENT: "MACRO-LEVEL INTENTS"
        Every section's 'intent' must be a detailed macro-brief (50-100 words) that explicitly includes:
        1. PRIMARY FOCUS: The overarching goal of this section.
        2. NARRATIVE PURPOSE: How this section serves the overall document goal.
        3. SCOPE BOUNDARY: What explicitly belongs in OTHER sections.

        RULES:
        1. Create a logical sequence of sections.
        2. Set header 'level' to 2 (for ##) or 3 (for ###).
        3. The 'bridge' explains how to transition into this section from previous ones.
        4. Assign a writer used for the title of the section
        5. ASSIGN ASSEMBLER: You must assign exactly ONE Assembler ID from the [ALLOWED_ASSEMBLERS] list to handle the micro-delegation for each section.
        
        OUTPUT PROTOCOL:
        You MUST respond ONLY with a valid, raw JSON object. Do not include markdown formatting or conversational text.

        JSON SCHEMA REQUIRED:
        {
          "sections": [
            {
              "id": "unique-slug",
              "header": "Section Title",
              "level": 2,
              "intent": "FOCUS: [Macro goal] \\nPURPOSE: [Narrative role] \\nBOUNDARY: [What to save for later]",
              "bridge": "Transition context",
              "assemblerId": "chosen-assembler-id",
              "writerId"; "chose-writer-id
            }
          ]
        }
      `.trim();
    } else {
      this.systemInstruction = `
        You are a Content Editor delegating micro-tasks for a single document section.
        DELEGATION STRATEGY: ${this.behaviour}
        ${this.learnedContext ? `LEARNED CONTEXT:\n${this.learnedContext}` : ""}

        CRITICAL REQUIREMENT: "FUTURE-AWARE INTENTS"
        Every block's 'intent' must be a highly detailed micro-brief (50-150 words) that explicitly includes:
        1. PRIMARY FOCUS: The specific technical or narrative goal of THIS block.
        2. SCOPE BOUNDARY: Explicitly list what NOT to mention because it belongs in a later block or section.
        3. THE HAND-OFF: How this block should end to prime the reader for the next specific block.

        RULES:
        1. Break the section's intent down into 1 or more atomic blocks.
        2. Assign exactly ONE Writer ID from the [ALLOWED_WRITERS] to each block based on their description.

        OUTPUT PROTOCOL:
        You MUST respond ONLY with a valid, raw JSON object. Do not include markdown formatting or conversational text.

        JSON SCHEMA REQUIRED:
        {
          "blocks": [
            {
              "id": "b1",
              "intent": "FOCUS: [What to write] \\nBOUNDARY: [What to avoid] \\nHAND-OFF: [How to end]",
              "writerId": "chosen-writer-id"
            }
          ]
        }
      `.trim();
    }
  }

  /**
   * Helper utility to safely extract and parse JSON from LLM outputs
   */
  private safelyParseJson<T>(text: string, context: string): T {
    try {
      const cleanText = text
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
      return JSON.parse(cleanText) as T;
    } catch (error) {
      throw new Error(
        `Assembler failed to output valid JSON for ${context}. Output was: ${text.substring(0, 100)}...`,
      );
    }
  }

  // ============================================================================
  // PASS 1: MACRO OUTLINE
  // ============================================================================

  async assembleOutline(ctx: {
    topic: string;
    goal: string;
    audience: string;
    allowedAssemblers: AgentInfo[];
    interact?: (
      params: AssembleOutlineResponse,
    ) => Promise<AssemblerInteractionResponse>;
    onRetry?: (error: Error) => Promise<boolean>;
    onThinking?: (agentId: string) => void;
  }): Promise<AssembleOutlineResponse> {
    if (this.role !== "outline") {
      throw new Error(
        `Assembler "${this.id}" is restricted to 'block' delegation and cannot generate outlines.`,
      );
    }

    let currentFeedback: string | undefined = undefined;

    while (true) {
      try {
        if (ctx.onThinking) ctx.onThinking(this.id);

        const assemblersContext = ctx.allowedAssemblers
          .map((a) => `- ${a.id}: ${a.description}`)
          .join("\n");
        const prompt = `Topic: ${ctx.topic}\nGoal: ${ctx.goal}\nAudience: ${ctx.audience}\n\n[ALLOWED_ASSEMBLERS]\n${assemblersContext}\n[/ALLOWED_ASSEMBLERS]`;

        const text = await AiService.execute(
          currentFeedback
            ? `${prompt}\n\nUSER FEEDBACK: ${currentFeedback}`
            : prompt,
          {
            model: this.model,
            systemInstruction: this.systemInstruction, // Using the constructor-injected instruction
            history: this.history,
            apiKey: this.apiKey,
          },
        );

        this.history.push(
          {
            role: "user",
            parts: [
              {
                text: currentFeedback ? `FEEDBACK: ${currentFeedback}` : prompt,
              },
            ],
          },
          { role: "model", parts: [{ text }] },
        );

        const parsed = this.safelyParseJson<{ sections: OutlineSection[] }>(
          text,
          "Assemble Outline",
        );

        if (
          !parsed.sections ||
          !Array.isArray(parsed.sections) ||
          parsed.sections.length === 0
        ) {
          throw new Error(
            "Assembler returned JSON, but the 'sections' array is missing or empty.",
          );
        }

        const generated: AssembleOutlineResponse = {
          agentId: this.id,
          sections: parsed.sections,
        };

        if (!ctx.interact) return generated;
        const interaction = await ctx.interact(generated);
        if (interaction.action === "proceed") return generated;

        currentFeedback = interaction.feedback;
      } catch (error: any) {
        await LoggerService.error("Assembler Macro failed", {
          error: error.message,
        });
        if (ctx.onRetry && (await ctx.onRetry(error))) continue;
        throw error;
      }
    }
  }

  // ============================================================================
  // PASS 2: MICRO BLOCKS
  // ============================================================================

  async assembleBlocks(ctx: {
    section: OutlineSection;
    allowedWriters: AgentInfo[];
    interact?: (
      params: AssembleBlocksResponse,
    ) => Promise<AssemblerInteractionResponse>;
    onRetry?: (error: Error) => Promise<boolean>;
    onThinking?: (agentId: string) => void;
  }): Promise<AssembleBlocksResponse> {
    if (this.role !== "block") {
      throw new Error(
        `Assembler "${this.id}" is restricted to 'outline' planning and cannot delegate blocks.`,
      );
    }

    let currentFeedback: string | undefined = undefined;

    while (true) {
      try {
        if (ctx.onThinking) ctx.onThinking(this.id);

        const writersContext = ctx.allowedWriters
          .map((w) => `- ${w.id}: ${w.description}`)
          .join("\n");

        const prompt = `
          Section Header: ${ctx.section.header}
          Section Intent: ${ctx.section.intent}
          Section Bridge: ${ctx.section.bridge || "None"}
          
          [ALLOWED_WRITERS]
          ${writersContext}
          [/ALLOWED_WRITERS]
        `.trim();

        const text = await AiService.execute(
          currentFeedback
            ? `${prompt}\n\nUSER FEEDBACK: ${currentFeedback}`
            : prompt,
          {
            model: this.model,
            systemInstruction: this.systemInstruction, // Using the constructor-injected instruction
            history: this.history,
            apiKey: this.apiKey,
          },
        );

        this.history.push(
          {
            role: "user",
            parts: [
              {
                text: currentFeedback ? `FEEDBACK: ${currentFeedback}` : prompt,
              },
            ],
          },
          { role: "model", parts: [{ text }] },
        );

        const parsed = this.safelyParseJson<{ blocks: BlockTask[] }>(
          text,
          "Assemble Blocks",
        );

        if (
          !parsed.blocks ||
          !Array.isArray(parsed.blocks) ||
          parsed.blocks.length === 0
        ) {
          throw new Error(
            "Assembler returned JSON, but the 'blocks' array is missing or empty.",
          );
        }

        const generated: AssembleBlocksResponse = {
          agentId: this.id,
          blocks: parsed.blocks,
        };

        if (!ctx.interact) return generated;
        const interaction = await ctx.interact(generated);
        if (interaction.action === "proceed") return generated;

        currentFeedback = interaction.feedback;
      } catch (error: any) {
        await LoggerService.error("Assembler Micro failed", {
          error: error.message,
        });
        if (ctx.onRetry && (await ctx.onRetry(error))) continue;
        throw error;
      }
    }
  }
}

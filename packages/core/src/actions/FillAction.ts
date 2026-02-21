// src/actions/FillAction.ts
import { Persona, PersonaInteractionHandler } from "../agents/Persona.js";
import { Writer, WriterInteractionHandler } from "../agents/Writer.js";
import { AgentService } from "../services/AgentService.js";
import { LoggerService } from "../services/LoggerService.js";
import {
  AgentPair,
  getAgent,
  getAgentsByType,
} from "../services/RegistryService.js";
import { BlockBlueprint, SectionBlueprint } from "../types/index.js";

// 1. Updated parameters: Takes both the Section and the specific Block
export interface FillExecuteParams {
  section: SectionBlueprint;
  block: BlockBlueprint;
  topic: string;
  goal: string;
  audience: string;
  isFirst: boolean;
  isLast: boolean;
}

export class FillAction {
  private _onWrite?: WriterInteractionHandler;
  private _onRephrase?: PersonaInteractionHandler;
  private _onRetry?: (err: Error) => Promise<boolean>;
  private _onStart?: (data: string) => void;
  private _onWriting?: (data: { id: string; writerId: string }) => void;
  private _onRephrasing?: (data: { id: string; personaId: string }) => void;

  private persona: Persona;
  private writers: Writer[];

  constructor(
    public workspaceRoot: string,
    personaId: string,
    agents: AgentPair[],
  ) {
    const persona = getAgent(agents, "persona", personaId);

    if (!persona) {
      throw new Error(
        `FillAction: Persona "${personaId}" not found in the registry.`,
      );
    }

    this.persona = persona.agent;
    this.writers = getAgentsByType(agents, "writer").map((a) => a.agent);

    if (this.writers.length === 0) {
      throw new Error("FillAction: No writers found in the registry.");
    }
  }

  onStart(cb: (data: string) => void) {
    this._onStart = cb;
    return this;
  }

  onWriting(cb: (data: { id: string; writerId: string }) => void) {
    this._onWriting = cb;
    return this;
  }

  onWrite(handler: WriterInteractionHandler) {
    this._onWrite = handler;
    return this;
  }

  onRephrasing(cb: (data: { id: string; personaId: string }) => void) {
    this._onRephrasing = cb;
    return this;
  }

  onRephrase(handler: PersonaInteractionHandler) {
    this._onRephrase = handler;
    return this;
  }

  onRetry(handler: (err: Error) => Promise<boolean>) {
    this._onRetry = handler;
    return this;
  }

  async execute({
    section,
    block,
    topic,
    goal,
    audience,
    isFirst,
    isLast,
  }: FillExecuteParams): Promise<string> {
    await LoggerService.info("FillAction: Starting execution for block", {
      blockId: block.id,
    });

    // 2. Intent now comes directly from the JSON AST, no more REGEX parsing needed!
    const intent = block.intent;

    // 3. Writer ID now comes from the block
    const writer = this.writers.find((w) => w.id === block.writerId);
    if (!writer) {
      throw new Error(`FillAction: Writer "${block.writerId}" not found.`);
    }

    this._onStart?.(block.id);

    // 1. Neutral Writing Phase
    const writerThreadId = `fill-${block.id}-write-${Date.now()}`;
    let writerTurn = 0;
    const neutral = await writer.write({
      intent,
      topic,
      goal,
      audience,
      bridge: section.bridge || "",
      isFirst,
      isLast,
      interact: async (params) => {
        const interaction = (await this._onWrite?.(params)) || {
          action: "proceed",
        };

        if (interaction.action === "feedback") {
          writerTurn++;
        }

        await AgentService.appendFeedback(
          this.workspaceRoot,
          "writer",
          params.agentId,
          {
            source: "action",
            outcome: interaction.action === "proceed" ? "accepted" : "feedback",
            threadId: writerThreadId,
            turn: writerTurn,
            ...(interaction.action === "feedback"
              ? { text: interaction.feedback }
              : {}),
          },
        );

        return interaction;
      },
      onRetry: this._onRetry,
      onThinking: (agentId) =>
        this._onWriting?.({ id: block.id, writerId: agentId }),
    });

    // 2. Persona Rephrasing Phase
    const personaThreadId = `fill-${block.id}-style-${Date.now()}`;
    let personaTurn = 0;
    const rephrased = await this.persona.rephrase({
      header: neutral.header,
      content: neutral.content,
      interact: async (params) => {
        const interaction = (await this._onRephrase?.(params)) || {
          action: "proceed",
        };

        if (interaction.action === "feedback") {
          personaTurn++;
        }

        await AgentService.appendFeedback(
          this.workspaceRoot,
          "persona",
          params.agentId,
          {
            source: "action",
            outcome: interaction.action === "proceed" ? "accepted" : "feedback",
            threadId: personaThreadId,
            turn: personaTurn,
            ...(interaction.action === "feedback"
              ? { text: interaction.feedback }
              : {}),
          },
        );

        return interaction;
      },
      onRetry: this._onRetry,
      onThinking: (agentId) =>
        this._onRephrasing?.({ id: block.id, personaId: agentId }),
    });

    await LoggerService.info("FillAction: Execution finished", {
      blockId: block.id,
    });

    // 4. Return pure content. Markdown headers (#, ##) will now be compiled
    // downstream by the CompilerService instead of injected here.
    return rephrased.content;
  }
}

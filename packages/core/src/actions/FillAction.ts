// packages/core/src/actions/FillAction.ts
import { Persona, PersonaResponse } from "../agents/Persona.js";
import { Writer, WriterResponse } from "../agents/Writer.js";
import { LoggerService } from "../services/LoggerService.js";
import {
  AgentPair,
  getAgent,
  getAgentsByType,
} from "../services/RegistryService.js";
import { BlockBlueprint, SectionBlueprint } from "../types/index.js";
import { BaseAction, ResolveInteractionHandler } from "./BaseAction.js";

export interface FillExecuteParams {
  section: SectionBlueprint; // Passed for macro context (like bridge)
  block: BlockBlueprint; // The specific micro-task
  topic: string;
  goal: string;
  audience: string;
  isFirst: boolean;
  isLast: boolean;
}

export class FillAction extends BaseAction {
  private _onWrite?: ResolveInteractionHandler<WriterResponse>;
  private _onRephrase?: ResolveInteractionHandler<PersonaResponse>;
  private _onRetry?: (err: Error) => Promise<boolean>;
  private _onStart?: (data: string) => void;
  private _onWriting?: (data: { id: string; writerId: string }) => void;
  private _onRephrasing?: (data: { id: string; personaId: string }) => void;

  private persona: Persona;
  private writers: Writer[];

  constructor(workspaceRoot: string, personaId: string, agents: AgentPair[]) {
    super(workspaceRoot);

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

  onWrite(handler: ResolveInteractionHandler<WriterResponse>) {
    this._onWrite = handler;
    return this;
  }

  onRephrasing(cb: (data: { id: string; personaId: string }) => void) {
    this._onRephrasing = cb;
    return this;
  }

  onRephrase(handler: ResolveInteractionHandler<PersonaResponse>) {
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

    // 1. Locate the assigned writer for this specific block
    const writer = this.writers.find((w) => w.id === block.writerId);
    if (!writer) {
      throw new Error(`FillAction: Writer "${block.writerId}" not found.`);
    }

    this._onStart?.(block.id);

    // ==========================================
    // 2. Neutral Writing Phase
    // ==========================================
    const writerThreadId = `fill-${block.id}-write-${Date.now()}`;
    let writerTurn = 0;

    const neutral = await writer.write({
      intent: block.intent, // Using the rich block intent (Focus/Boundary/Handoff)
      topic,
      goal,
      audience,
      bridge: section.bridge || "",
      isFirst,
      isLast,
      interact: async (params) => {
        const result = await this.resolveInteraction(
          "writer",
          params.agentId,
          params,
          this._onWrite,
          { threadId: writerThreadId, turn: writerTurn },
        );

        if (result.action === "feedback") writerTurn++;
        return result;
      },
      onRetry: this._onRetry,
      onThinking: (agentId) =>
        this._onWriting?.({ id: block.id, writerId: agentId }),
    });

    // ==========================================
    // 3. Persona Rephrasing Phase
    // ==========================================
    const personaThreadId = `fill-${block.id}-style-${Date.now()}`;
    let personaTurn = 0;

    const rephrased = await this.persona.rephrase({
      content: neutral.content, // Pass only the content (we neutered the header capability)
      interact: async (params) => {
        const result = await this.resolveInteraction(
          "persona",
          params.agentId,
          params,
          this._onRephrase,
          { threadId: personaThreadId, turn: personaTurn },
        );

        if (result.action === "feedback") personaTurn++;
        return result;
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

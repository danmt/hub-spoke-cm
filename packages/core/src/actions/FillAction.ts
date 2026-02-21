// packages/core/src/actions/FillAction.ts
import { Persona, PersonaResponse } from "../agents/Persona.js";
import { Writer, WriterResponse } from "../agents/Writer.js";
import { LoggerService } from "../services/LoggerService.js";
import {
  AgentPair,
  getAgent,
  getAgentsByType,
} from "../services/RegistryService.js";
import { SectionBlueprint } from "../types/index.js";
import { BaseAction, ResolveInteractionHandler } from "./BaseAction.js";

/**
 * Unified execution parameters.
 * By requiring targetId and intent explicitly, we can use this for
 * both Section Headers and standard content Blocks.
 */
export interface FillExecuteParams {
  targetId: string; // block.id or `header-${section.id}`
  intent: string; // block.intent or the header optimization prompt
  writerId: string; // The specific writer chosen by the Assembler
  section: SectionBlueprint; // Macro context (bridge, goals)
  topic: string;
  goal: string;
  audience: string;
  isFirst: boolean;
  isLast: boolean;
}

export class FillAction extends BaseAction {
  private _onStart?: (data: string) => void;
  private _onComplete?: (data: string) => void;
  private _onWriting?: (data: { id: string; writerId: string }) => void;
  private _onWrite?: ResolveInteractionHandler<WriterResponse>;
  private _onRephrasing?: (data: { id: string; personaId: string }) => void;
  private _onRephrase?: ResolveInteractionHandler<PersonaResponse>;
  private _onRetry?: (err: Error) => Promise<boolean>;

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

  onComplete(cb: (data: string) => void) {
    this._onComplete = cb;
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
    targetId,
    intent,
    writerId,
    section,
    topic,
    goal,
    audience,
    isFirst,
    isLast,
  }: FillExecuteParams): Promise<string> {
    await LoggerService.info(`FillAction: Executing turn for ${targetId}`, {
      targetId,
      writerId,
    });

    // 1. Locate the assigned writer for this specific task
    const writer = this.writers.find((w) => w.id === writerId);
    if (!writer) {
      throw new Error(`FillAction: Writer "${writerId}" not found.`);
    }

    this._onStart?.(targetId);

    const timestamp = Date.now();

    // ==========================================
    // 2. Neutral Writing Phase (Optimization)
    // ==========================================
    const writerThreadId = `fill-write-${targetId}-${timestamp}`;
    let writerTurn = 0;

    const neutral = await writer.write({
      intent: intent, // The specific drafting instruction
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
        this._onWriting?.({ id: targetId, writerId: agentId }),
    });

    // ==========================================
    // 3. Persona Rephrasing Phase (Styling)
    // ==========================================
    const personaThreadId = `fill-style-${targetId}-${timestamp}`;
    let personaTurn = 0;

    const rephrased = await this.persona.rephrase({
      content: neutral.content, // Pure content pass to prevent header drift
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
        this._onRephrasing?.({ id: targetId, personaId: agentId }),
    });

    await LoggerService.info(`FillAction: Finalized ${targetId}`);

    this._onComplete?.(targetId);

    // 4. Return pure content. Markdown compilation occurs downstream.
    return rephrased.content;
  }
}

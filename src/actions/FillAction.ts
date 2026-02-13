// src/actions/FillAction.ts
import { Persona, PersonaInteractionHandler } from "../agents/Persona.js";
import { Writer, WriterInteractionHandler } from "../agents/Writer.js";
import { LoggerService } from "../services/LoggerService.js";
import {
  AgentPair,
  getAgent,
  getAgentsByType,
} from "../services/RegistryService.js";
import { SectionBlueprint } from "../types/index.js";

export interface FillExecuteParams {
  sectionId: string;
  sectionBody: string;
  blueprint: SectionBlueprint;
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

  constructor(personaId: string, agents: AgentPair[]) {
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

  onStart(cb: typeof this._onStart) {
    this._onStart = cb;
    return this;
  }

  onWriting(cb: typeof this._onWriting) {
    this._onWriting = cb;
    return this;
  }

  onWrite(handler: WriterInteractionHandler) {
    this._onWrite = handler;
    return this;
  }

  onRephrasing(cb: typeof this._onRephrasing) {
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
    sectionId,
    sectionBody,
    blueprint,
    topic,
    goal,
    audience,
    isFirst,
    isLast,
  }: FillExecuteParams): Promise<string> {
    await LoggerService.info("FillAction: Starting execution");

    const TODO_REGEX = />\s*\*\*?TODO:?\*?\s*(.*)/i;
    const intent =
      sectionBody.match(TODO_REGEX)?.[1]?.trim() || "Expand details.";

    const writer = this.writers.find((w) => w.id === blueprint.writerId);
    if (!writer) {
      throw new Error(`FillAction: Writer "${blueprint.writerId}" not found.`);
    }

    this._onStart?.(sectionId);

    // 1. Neutral Writing Phase
    const neutral = await writer.write({
      intent,
      topic,
      goal,
      audience,
      bridge: blueprint.bridge,
      isFirst,
      isLast,
      interact: this._onWrite,
      onRetry: this._onRetry,
      onThinking: () =>
        this._onWriting?.({ id: sectionId, writerId: writer.id }),
    });

    // 2. Persona Rephrasing Phase
    const rephrased = await this.persona.rephrase({
      header: neutral.header,
      content: neutral.content,
      interact: this._onRephrase,
      onRetry: this._onRetry,
      onThinking: () =>
        this._onRephrasing?.({ id: sectionId, personaId: this.persona.id }),
    });

    await LoggerService.info("FillAction: Execution finished");

    return `## ${rephrased.header}\n\n${rephrased.content}`;
  }
}

// src/actions/FillAction.ts
import { Persona, PersonaInteractionHandler } from "../agents/Persona.js";
import { Writer, WriterInteractionHandler } from "../agents/Writer.js";
import { IoService } from "../services/IoService.js";
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
    const writerThreadId = `fill-${sectionId}-write-${Date.now()}`;
    let writerTurn = 0;
    const neutral = await writer.write({
      intent,
      topic,
      goal,
      audience,
      bridge: blueprint.bridge,
      isFirst,
      isLast,
      interact: async (params) => {
        const interaction = (await this._onWrite?.(params)) || {
          action: "proceed",
        };

        if (interaction.action === "feedback") {
          await IoService.appendAgentInteraction(
            this.workspaceRoot,
            "writer",
            params.agentId,
            "action",
            "feedback",
            writerThreadId,
            writerTurn,
            interaction.feedback,
          );
          writerTurn++;
        } else {
          await IoService.appendAgentInteraction(
            this.workspaceRoot,
            "writer",
            params.agentId,
            "action",
            "accepted",
            writerThreadId,
            writerTurn,
          );
        }

        return interaction;
      },
      onRetry: this._onRetry,
      onThinking: (agentId) =>
        this._onWriting?.({ id: sectionId, writerId: agentId }),
    });

    // 2. Persona Rephrasing Phase
    const personaThreadId = `fill-${sectionId}-style-${Date.now()}`;
    let personaTurn = 0;
    const rephrased = await this.persona.rephrase({
      header: neutral.header,
      content: neutral.content,
      interact: async (params) => {
        const interaction = (await this._onRephrase?.(params)) || {
          action: "proceed",
        };

        if (interaction.action === "feedback") {
          await IoService.appendAgentInteraction(
            this.workspaceRoot,
            "persona",
            params.agentId,
            "action",
            "feedback",
            personaThreadId,
            personaTurn,
            interaction.feedback,
          );
          personaTurn++;
        } else {
          await IoService.appendAgentInteraction(
            this.workspaceRoot,
            "persona",
            params.agentId,
            "action",
            "accepted",
            personaThreadId,
            personaTurn,
          );
        }

        return interaction;
      },
      onRetry: this._onRetry,
      onThinking: (agentId) =>
        this._onRephrasing?.({ id: sectionId, personaId: agentId }),
    });

    await LoggerService.info("FillAction: Execution finished");

    return `## ${rephrased.header}\n\n${rephrased.content}`;
  }
}

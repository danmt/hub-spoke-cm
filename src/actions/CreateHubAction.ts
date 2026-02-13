// src/actions/CreateHubAction.ts
import {
  Architect,
  ArchitectInteractionHandler,
  ArchitectResponse,
  Brief,
} from "../agents/Architect.js";
import {
  Assembler,
  AssembleResponse,
  AssemblerInteractionHandler,
} from "../agents/Assembler.js";
import {
  Persona,
  PersonaInteractionHandler,
  PersonaResponse,
} from "../agents/Persona.js";
import { LoggerService } from "../services/LoggerService.js";
import { AgentPair, getAgentsByType } from "../services/RegistryService.js";

export interface CreateHubActionResult {
  architecture: ArchitectResponse;
  assembly: AssembleResponse;
  personification: PersonaResponse;
}

export class CreateHubAction {
  private _onArchitecting?: (data: string) => void;
  private _onArchitect?: ArchitectInteractionHandler;
  private _onAssembling?: (data: string) => void;
  private _onAssembler?: AssemblerInteractionHandler;
  private _onRephrasing?: (personaId: string) => void;
  private _onRephrase?: PersonaInteractionHandler;
  private _onRetry?: (err: Error) => Promise<boolean>;

  private architect: Architect;
  private assemblers: Assembler[];
  private personas: Persona[];

  constructor(manifest: string, baseline: Partial<Brief>, agents: AgentPair[]) {
    this.architect = new Architect(manifest, baseline);

    this.assemblers = getAgentsByType(agents, "assembler").map((a) => a.agent);

    if (this.assemblers.length === 0) {
      throw new Error("CreateHubAction: No assemblers found in the registry.");
    }

    this.personas = getAgentsByType(agents, "persona").map((a) => a.agent);

    if (this.personas.length === 0) {
      throw new Error("CreateHubAction: No personas found in the registry.");
    }
  }

  onArchitecting(cb: typeof this._onArchitecting) {
    this._onArchitecting = cb;
    return this;
  }

  onArchitect(handler: ArchitectInteractionHandler) {
    this._onArchitect = handler;
    return this;
  }

  onAssembling(cb: typeof this._onAssembling) {
    this._onAssembling = cb;
    return this;
  }

  onAssembler(handler: AssemblerInteractionHandler) {
    this._onAssembler = handler;
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

  async execute(): Promise<CreateHubActionResult> {
    await LoggerService.info("CreateHubAction: Starting execution");

    // 1. Architect Phase (Refine the Brief)
    const architecture = await this.architect.architect({
      interact: this._onArchitect,
      onThinking: () => this._onArchitecting?.("default"),
      onRetry: this._onRetry,
    });

    const assemblerId = architecture.brief.assemblerId;
    const assembler = this.assemblers.find((a) => a.id === assemblerId);

    if (!assembler) {
      throw new Error(
        `CreateHubAction: Assembler "${assemblerId}" not found in the provided list.`,
      );
    }

    // 2. Assembler Phase (Generate the Blueprint)
    const assembly = await assembler.assemble({
      topic: architecture.brief.topic,
      goal: architecture.brief.goal,
      audience: architecture.brief.audience,
      interact: this._onAssembler,
      onThinking: () => this._onAssembling?.(assemblerId),
      onRetry: this._onRetry,
    });

    // 3. Rephrasing phase
    const personaId = architecture.brief.personaId;
    const persona = this.personas.find((p) => p.id === personaId);

    if (!persona) {
      throw new Error(
        `CreateHubAction: Persona "${personaId}" not found in the provided list.`,
      );
    }

    const personification = await persona.rephrase({
      header: architecture.brief.topic,
      content: `Write an engaging one sentence long description for this content hub. Topic: ${architecture.brief.topic}. Goal: ${architecture.brief.goal}.`,
      interact: this._onRephrase,
      onThinking: () => this._onRephrasing?.(personaId),
      onRetry: this._onRetry,
    });

    await LoggerService.info("CreateHubAction: Execution finished");

    return {
      architecture,
      assembly,
      personification,
    };
  }
}

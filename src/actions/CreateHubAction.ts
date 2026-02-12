// src/actions/CreateHubAction.ts
import path from "path";
import {
  Architect,
  ArchitectInteractionHandler,
  ArchitectResponse,
} from "../agents/Architect.js";
import {
  Assembler,
  AssembleResponse,
  AssemblerInteractionHandler,
} from "../agents/Assembler.js";
import { IoService } from "../services/IoService.js";
import { LoggerService } from "../services/LoggerService.js";
import { ParserService } from "../services/ParserService.js";

export interface CreateHubActionResult {
  filePath: string;
  fileContent: string;
  architecture: ArchitectResponse;
  assembly: AssembleResponse;
}

export class CreateHubAction {
  private _onArchitecting?: (data: string) => void;
  private _onArchitectInteract?: ArchitectInteractionHandler;
  private _onAssembling?: (data: string) => void;
  private _onAssemblerInteract?: AssemblerInteractionHandler;
  private _onRetry?: (err: Error) => Promise<boolean>;

  constructor(
    private architect: Architect,
    private assemblers: Assembler[],
  ) {}

  onArchitecting(cb: typeof this._onArchitecting) {
    this._onArchitecting = cb;
    return this;
  }

  onArchitectInteract(handler: ArchitectInteractionHandler) {
    this._onArchitectInteract = handler;
    return this;
  }

  onAssembling(cb: typeof this._onAssembling) {
    this._onAssembling = cb;
    return this;
  }

  onAssemblerInteract(handler: AssemblerInteractionHandler) {
    this._onAssemblerInteract = handler;
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
      interact: this._onArchitectInteract,
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
      interact: this._onAssemblerInteract,
      onThinking: () => this._onAssembling?.(assemblerId),
      onRetry: this._onRetry,
    });

    // 3. Scaffolding Phase
    const hubDir = await IoService.createHubDirectory(assembly.blueprint.hubId);
    const filePath = path.join(hubDir, "hub.md");

    const fileContent = ParserService.generateScaffold(
      "hub",
      architecture.brief,
      assembly.blueprint,
    );

    
    await LoggerService.info("CreateHubAction: Execution finished", {
      filePath,
    });

    return {
      filePath,
      fileContent,
      architecture: architecture,
      assembly: assembly,
    };
  }
}

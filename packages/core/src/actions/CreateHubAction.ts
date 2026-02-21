// src/actions/CreateHubAction.ts
import {
  Architect,
  ArchitectInteractionHandler,
  ArchitectResponse,
  Brief,
} from "../agents/Architect.js";
import {
  AssembleBlocksResponse,
  AssembleOutlineResponse,
  Assembler,
} from "../agents/Assembler.js";
import {
  Persona,
  PersonaInteractionHandler,
  PersonaResponse,
} from "../agents/Persona.js";
import { Writer } from "../agents/Writer.js";
import { AgentService } from "../services/AgentService.js";
import { LoggerService } from "../services/LoggerService.js";
import { AgentPair, getAgentsByType } from "../services/RegistryService.js";
import { SectionBlueprint } from "../types/index.js";

export interface CreateHubActionResult {
  architecture: ArchitectResponse;
  sections: SectionBlueprint[];
  personification: PersonaResponse;
}

export class CreateHubAction {
  private _onArchitecting?: (data: string) => void;
  private _onArchitect?: ArchitectInteractionHandler;

  private _onAssemblingOutline?: (agentId: string) => void;
  private _onAssembleOutline?: (
    params: AssembleOutlineResponse,
  ) => Promise<any>;

  private _onAssemblingBlocks?: (
    agentId: string,
    sectionHeader: string,
  ) => void;
  private _onAssembleBlocks?: (
    params: AssembleBlocksResponse,
    sectionHeader: string,
  ) => Promise<any>;

  private _onRephrasing?: (personaId: string) => void;
  private _onRephrase?: PersonaInteractionHandler;
  private _onRetry?: (err: Error) => Promise<boolean>;

  private architect: Architect;
  private assemblers: Assembler[];
  private writers: Writer[];
  private personas: Persona[];

  constructor(
    public workspaceRoot: string,
    apiKey: string,
    model: string,
    manifest: string,
    baseline: Partial<Brief>,
    agents: AgentPair[],
  ) {
    this.architect = new Architect(apiKey, model, manifest, baseline);

    this.assemblers = getAgentsByType(agents, "assembler").map((a) => a.agent);

    if (this.assemblers.length === 0) {
      throw new Error("CreateHubAction: No assemblers found in the registry.");
    }

    this.personas = getAgentsByType(agents, "persona").map((a) => a.agent);

    if (this.personas.length === 0) {
      throw new Error("CreateHubAction: No personas found in the registry.");
    }

    this.writers = getAgentsByType(agents, "writer").map((a) => a.agent);

    if (this.writers.length === 0) {
      throw new Error("CreateHubAction: No writers found in the registry.");
    }
  }

  onArchitecting(cb: (data: string) => void) {
    this._onArchitecting = cb;
    return this;
  }

  onArchitect(handler: ArchitectInteractionHandler) {
    this._onArchitect = handler;
    return this;
  }

  onAssemblingOutline(cb: (id: string) => void) {
    this._onAssemblingOutline = cb;
    return this;
  }

  onAssembleOutline(
    handler: (params: AssembleOutlineResponse) => Promise<any>,
  ) {
    this._onAssembleOutline = handler;
    return this;
  }

  onAssemblingBlocks(cb: (id: string, header: string) => void) {
    this._onAssemblingBlocks = cb;
    return this;
  }

  onAssembleBlocks(
    handler: (params: AssembleBlocksResponse, header: string) => Promise<any>,
  ) {
    this._onAssembleBlocks = handler;
    return this;
  }

  onRephrasing(cb: (id: string) => void) {
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

    // ==========================================
    // 1. Architect Phase (Refine the Brief)
    // ==========================================
    const architecture = await this.architect.architect({
      interact: this._onArchitect,
      onThinking: () => this._onArchitecting?.("default"),
      onRetry: this._onRetry,
    });

    const outlinerId = architecture.brief.assemblerId;
    const outliner = this.assemblers.find((a) => a.id === outlinerId);

    if (!outliner) {
      throw new Error(
        `CreateHubAction: Outliner Assembler "${outlinerId}" not found in the provided list.`,
      );
    }

    // ==========================================
    // 2. Macro Phase: Assemble Outline
    // ==========================================
    const outlineThreadId = `create-outline-${Date.now()}`;
    let outlineTurn = 0;

    // Pass the pool of allowed assemblers to the Outliner so it can assign them
    const allowedAssemblersContext = this.assemblers
      .filter((a) => architecture.brief.allowedAssemblerIds.includes(a.id))
      .map((a) => ({ id: a.id, description: a.description }));

    const outline = await outliner.assembleOutline({
      topic: architecture.brief.topic,
      goal: architecture.brief.goal,
      audience: architecture.brief.audience,
      allowedAssemblers: allowedAssemblersContext,
      onThinking: (agentId) => this._onAssemblingOutline?.(agentId),
      onRetry: this._onRetry,
      interact: async (params) => {
        const interaction = (await this._onAssembleOutline?.(params)) || {
          action: "proceed",
        };

        if (interaction.action === "feedback") outlineTurn++;

        await AgentService.appendFeedback(
          this.workspaceRoot,
          "assembler",
          params.agentId,
          {
            source: "action",
            outcome: interaction.action === "proceed" ? "accepted" : "feedback",
            threadId: outlineThreadId,
            turn: outlineTurn,
            ...(interaction.action === "feedback"
              ? { text: interaction.feedback }
              : {}),
          },
        );

        return interaction;
      },
    });

    // ==========================================
    // 3. Micro Phase: Assemble Blocks per Section
    // ==========================================
    const finalSections: SectionBlueprint[] = [];
    const allowedWriters = this.writers
      .filter((w) => architecture.brief.allowedWriterIds.includes(w.id))
      .map((w) => ({ id: w.id, description: w.description }));

    for (const section of outline.sections) {
      // Find the specific Block Assembler assigned to this section
      // Fallback to outliner if the AI failed to assign one
      const sectionAssembler =
        this.assemblers.find((a) => a.id === section.assemblerId) || outliner;

      let blockTurn = 0;
      const blockThreadId = `create-blocks-${section.id}-${Date.now()}`;

      const micro = await sectionAssembler.assembleBlocks({
        section,
        allowedWriters,
        onThinking: (agentId) =>
          this._onAssemblingBlocks?.(agentId, section.header),
        onRetry: this._onRetry,
        interact: async (params) => {
          const interaction = (await this._onAssembleBlocks?.(
            params,
            section.header,
          )) || { action: "proceed" };

          if (interaction.action === "feedback") blockTurn++;

          await AgentService.appendFeedback(
            this.workspaceRoot,
            "assembler",
            params.agentId,
            {
              source: "action",
              outcome:
                interaction.action === "proceed" ? "accepted" : "feedback",
              threadId: blockThreadId,
              turn: blockTurn,
              ...(interaction.action === "feedback"
                ? { text: interaction.feedback }
                : {}),
            },
          );
          return interaction;
        },
      });

      // Stitch the micro blocks into the macro section
      finalSections.push({
        id: section.id,
        header: section.header,
        level: section.level,
        intent: section.intent,
        bridge: section.bridge,
        assemblerId: sectionAssembler.id,
        blocks: micro.blocks.map((b) => ({
          id: b.id,
          intent: b.intent,
          writerId: b.writerId,
          status: "pending",
        })),
      });
    }

    // ==========================================
    // 4. Persona Phase: Rephrase Hub Description
    // ==========================================
    const personaThreadId = `create-style-${Date.now()}`;
    let personaTurn = 0;
    const personaId = architecture.brief.personaId;
    const persona = this.personas.find((p) => p.id === personaId);

    if (!persona) {
      throw new Error(
        `CreateHubAction: Persona "${personaId}" not found in the provided list.`,
      );
    }

    const personification = await persona.rephrase({
      content: `Write an engaging one sentence long description for this content hub. Topic: ${architecture.brief.topic}. Goal: ${architecture.brief.goal}.`,
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

      onThinking: (agentId) => this._onRephrasing?.(agentId),
      onRetry: this._onRetry,
    });

    await LoggerService.info("CreateHubAction: Execution finished");

    return {
      architecture,
      sections: finalSections,
      personification,
    };
  }
}

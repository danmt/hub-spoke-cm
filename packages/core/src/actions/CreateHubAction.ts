// packages/core/src/actions/CreateHubAction.ts
import { Architect, ArchitectResponse, Brief } from "../agents/Architect.js";
import {
  AssembleBlocksResponse,
  AssembleOutlineResponse,
  Assembler,
} from "../agents/Assembler.js";
import { Persona, PersonaResponse } from "../agents/Persona.js";
import { Writer, WriterResponse } from "../agents/Writer.js";
import { LoggerService } from "../services/LoggerService.js";
import { AgentPair, getAgentsByType } from "../services/RegistryService.js";
import { SectionBlueprint } from "../types/index.js";
import { BaseAction, ResolveInteractionHandler } from "./BaseAction.js";

export interface CreateHubActionResult {
  architecture: ArchitectResponse;
  sections: SectionBlueprint[];
  personification: {
    title: string;
    description: string;
  };
}

export class CreateHubAction extends BaseAction {
  private _onArchitecting?: (data: string) => void;
  private _onArchitect?: ResolveInteractionHandler<ArchitectResponse>;
  private _onAssemblingOutline?: (agentId: string) => void;
  private _onAssembleOutline?: (
    params: AssembleOutlineResponse,
  ) => Promise<any>;
  private _onAssemblingBlocks?: (
    agentId: string,
    sectionHeader: string,
  ) => void;
  private _onAssembleBlocks?: ResolveInteractionHandler<AssembleBlocksResponse>;
  private _onWriting?: (data: { id: string; writerId: string }) => void;
  private _onWrite?: ResolveInteractionHandler<WriterResponse>;
  private _onRephrasing?: (personaId: string) => void;
  private _onRephrase?: ResolveInteractionHandler<PersonaResponse>;
  private _onRetry?: (err: Error) => Promise<boolean>;

  private architect: Architect;
  private assemblers: Assembler[];
  private writers: Writer[];
  private personas: Persona[];

  constructor(
    workspaceRoot: string,
    apiKey: string,
    model: string,
    manifest: string,
    baseline: Partial<Brief>,
    agents: AgentPair[],
  ) {
    super(workspaceRoot);

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

  onArchitect(handler: ResolveInteractionHandler<ArchitectResponse>) {
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

  onAssembleBlocks(handler: ResolveInteractionHandler<AssembleBlocksResponse>) {
    this._onAssembleBlocks = handler;
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

  onRephrasing(cb: (id: string) => void) {
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

  async execute(): Promise<CreateHubActionResult> {
    await LoggerService.info("CreateHubAction: Starting execution");

    // ==========================================
    // 1. Architect Phase (Refine the Brief)
    // ==========================================
    const architecture = await this.architect.architect({
      interact: async (params) => {
        if (!this._onArchitect) {
          return { action: "proceed" };
        }

        const interaction = await this._onArchitect(params);

        if (interaction.action === "skip") {
          return { action: "proceed" };
        }

        return interaction;
      },
      onThinking: () => this._onArchitecting?.("default"),
      onRetry: this._onRetry,
    });

    const persona = this.personas.find(
      (p) => p.id === architecture.brief.personaId,
    )!;

    if (!persona) {
      throw new Error(
        `CreateHubAction: Persona "${architecture.brief.personaId}" not found in the provided list.`,
      );
    }

    const timestamp = Date.now();

    // ==========================================
    // 2. Macro Pass (Outline)
    // ==========================================
    const outliner = this.assemblers.find(
      (a) => a.id === architecture.brief.assemblerId,
    )!;

    if (!outliner) {
      throw new Error(
        `CreateHubAction: Outliner Assembler "${architecture.brief.assemblerId}" not found in the provided list.`,
      );
    }

    const outlineThreadId = `assemble-outline-${timestamp}`;
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
      onThinking: (id) => this._onAssemblingOutline?.(id),
      onRetry: this._onRetry,
      interact: async (p) => {
        const interaction = await this.resolveInteraction(
          "assembler",
          p.agentId,
          p,
          this._onAssembleOutline,
          { threadId: outlineThreadId, turn: outlineTurn },
        );
        if (interaction.action === "feedback") outlineTurn++;
        return interaction;
      },
    });

    // ==========================================
    // 3. Micro Pass (Blocks)
    // ==========================================
    const finalSections: SectionBlueprint[] = [];
    for (const section of outline.sections) {
      const blockThreadId = `assemble-blocks-${section.id}-${timestamp}`;
      let blockTurn = 0;
      const blockAssembler = this.assemblers.find(
        (a) => a.id === section.assemblerId,
      );

      if (!blockAssembler) {
        throw new Error(
          `CreateHubAction: Block Assembler "${section.assemblerId}" not found in the provided list.`,
        );
      }

      const micro = await blockAssembler.assembleBlocks({
        section,
        allowedWriters: this.writers.map((w) => ({
          id: w.id,
          description: w.description,
        })),
        onThinking: (id) => this._onAssemblingBlocks?.(id, section.header),
        onRetry: this._onRetry,
        interact: async (p) => {
          const interaction = await this.resolveInteraction(
            "assembler",
            p.agentId,
            p,
            this._onAssembleBlocks,
            { threadId: blockThreadId, turn: blockTurn },
          );
          if (interaction.action === "feedback") blockTurn++;
          return interaction;
        },
      });
      finalSections.push({
        ...section,
        title: "",
        status: "pending",
        writerId: section.writerId,
        blocks: micro.blocks.map((b) => ({ ...b, status: "pending" })),
      });
    }

    // ==========================================
    // 4. Metadata Passes (The 4-Pass Sequence)
    // ==========================================
    const titleWriter = this.writers.find(
      (w) => w.id === architecture.brief.titleWriterId,
    );

    if (!titleWriter) {
      throw new Error(
        `CreateHubAction: Title Writer "${architecture.brief.titleWriterId}" not found in the provided list.`,
      );
    }

    const writeTitleThreadId = `write-title-${timestamp}`;
    let writeTitleTurn = 0;

    const neutralTitle = await titleWriter.write({
      intent: `Generate a short technical title for a hub about ${architecture.brief.topic}.`,
      topic: architecture.brief.topic,
      goal: architecture.brief.goal,
      audience: architecture.brief.audience,
      bridge: "",
      isFirst: true,
      isLast: false,
      onThinking: (id) => this._onWriting?.({ id: "hub-title", writerId: id }),
      onRetry: this._onRetry,
      interact: async (p) => {
        const res = await this.resolveInteraction(
          "writer",
          p.agentId,
          p,
          this._onWrite,
          { threadId: writeTitleThreadId, turn: writeTitleTurn },
        );
        if (res.action === "feedback") writeTitleTurn++;
        return res;
      },
    });

    const styleTitleThreadId = `style-title-${timestamp}`;
    let styleTitleTurn = 0;

    const styledTitle = await persona.rephrase({
      content: neutralTitle.content,
      onThinking: (id) => this._onRephrasing?.(id),
      onRetry: this._onRetry,
      interact: async (p) => {
        const res = await this.resolveInteraction(
          "persona",
          p.agentId,
          p,
          this._onRephrase,
          { threadId: styleTitleThreadId, turn: styleTitleTurn },
        );
        if (res.action === "feedback") styleTitleTurn++;
        return res;
      },
    });

    // --- DESCRIPTION FLOW ---
    const descriptionWriter = this.writers.find(
      (w) => w.id === architecture.brief.descriptionWriterId,
    );

    if (!descriptionWriter) {
      throw new Error(
        `CreateHubAction: Title Writer "${architecture.brief.descriptionWriterId}" not found in the provided list.`,
      );
    }

    const writeDescriptionThreadId = `write-description-${timestamp}`;
    let writeDescriptionTurn = 0;

    const neutralDesc = await descriptionWriter.write({
      intent: `Write a one-sentence technical summary explaining the goal: ${architecture.brief.goal}.`,
      topic: architecture.brief.topic,
      goal: architecture.brief.goal,
      audience: architecture.brief.audience,
      bridge: "",
      isFirst: false,
      isLast: true,
      onThinking: (id) => this._onWriting?.({ id: "hub-desc", writerId: id }),
      onRetry: this._onRetry,
      interact: async (p) => {
        const interaction = await this.resolveInteraction(
          "writer",
          p.agentId,
          p,
          this._onWrite,
          { threadId: writeDescriptionThreadId, turn: writeDescriptionTurn },
        );
        if (interaction.action === "feedback") writeDescriptionTurn++;
        return interaction;
      },
    });

    const styleDescriptionThreadId = `style-description-${timestamp}`;
    let styleDescriptionTurn = 0;

    const styledDesc = await persona.rephrase({
      content: neutralDesc.content,
      onThinking: (id) => this._onRephrasing?.(id),
      onRetry: this._onRetry,
      interact: async (p) => {
        const interaction = await this.resolveInteraction(
          "persona",
          p.agentId,
          p,
          this._onRephrase,
          { threadId: styleDescriptionThreadId, turn: styleDescriptionTurn },
        );
        if (interaction.action === "feedback") styleDescriptionTurn++;
        return interaction;
      },
    });

    return {
      architecture,
      sections: finalSections,
      personification: {
        title: styledTitle.content,
        description: styledDesc.content,
      },
    };
  }
}

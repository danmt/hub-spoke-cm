// src/services/RegistryService.ts
import { Assembler } from "../agents/Assembler.js";
import { Persona } from "../agents/Persona.js";
import { Writer } from "../agents/Writer.js";
import { parseAssemblerArtifact } from "../utils/parseAssemblerArtifact.js";
import { parsePersonaArtifact } from "../utils/parsePersonaArtifact.js";
import { parseWriterArtifact } from "../utils/parseWriterArtifact.js";
import { LoggerService } from "./LoggerService.js";

export type ArtifactType = "persona" | "writer" | "assembler";

export interface BaseArtifact {
  id: string;
  type: ArtifactType;
  description: string;
  content: string;
  model?: string;
}

export interface PersonaArtifact extends BaseArtifact {
  type: "persona";
  name: string;
  language: string;
  tone: string;
  accent: string;
}

export interface WriterArtifact extends BaseArtifact {
  type: "writer";
}

export interface AssemblerArtifact extends BaseArtifact {
  type: "assembler";
  writerIds: string[];
}

export type Artifact = PersonaArtifact | WriterArtifact | AssemblerArtifact;

export type AgentPair =
  | { type: "persona"; artifact: PersonaArtifact; agent: Persona }
  | { type: "writer"; artifact: WriterArtifact; agent: Writer }
  | { type: "assembler"; artifact: AssemblerArtifact; agent: Assembler };

export function isAgentType<T extends AgentPair["type"]>(
  pair: AgentPair,
  type: T,
): pair is Extract<AgentPair, { type: T }> {
  return pair.type === type;
}

export function getAgentsByType<T extends AgentPair["type"]>(
  agents: AgentPair[],
  type: T,
): Extract<AgentPair, { type: T }>[] {
  return agents.filter((a): a is Extract<AgentPair, { type: T }> =>
    isAgentType(a, type),
  );
}

export function getAgent<T extends AgentPair["type"]>(
  agents: AgentPair[],
  type: T,
  id: string,
): Extract<AgentPair, { type: T }> | null {
  return (
    agents
      .filter((a): a is Extract<AgentPair, { type: T }> => isAgentType(a, type))
      .find(({ artifact }) => artifact.id === id) ?? null
  );
}

export interface RegistryProvider {
  listAgentFiles(folder: string): Promise<string[]>;
  readAgentFile(folder: string, filename: string): Promise<string>;
  getIdentifier(filename: string): string;
  setWorkspaceRoot(path: string): void;
}

export class RegistryService {
  private static provider: RegistryProvider | null = null;
  private static cachedArtifacts: Artifact[] = [];

  static setProvider(provider: RegistryProvider): void {
    this.provider = provider;
  }

  static setWorkspaceRoot(path: string): void {
    if (!this.provider) {
      throw new Error(
        "RegistryService: Cannot set root before provider is registered.",
      );
    }
    this.cachedArtifacts = [];
    this.provider.setWorkspaceRoot(path);
  }

  static hasProvider(): boolean {
    return this.provider !== null;
  }

  /**
   * Fetches all artifacts from the workspace.
   */
  static async sync(workspaceRoot: string): Promise<Artifact[]> {
    if (!this.provider) {
      throw new Error("RegistryService: RegistryProvider not registered.");
    }

    const folders: Record<string, ArtifactType> = {
      personas: "persona",
      writers: "writer",
      assemblers: "assembler",
    };

    const allArtifacts: Artifact[] = [];
    try {
      await LoggerService.debug("Scanning registry folders", { workspaceRoot });

      for (const [folder, type] of Object.entries(folders)) {
        const files = await this.provider.listAgentFiles(folder);
        const mdFiles = files.filter((f) => f.endsWith(".md"));

        for (const file of mdFiles) {
          const raw = await this.provider.readAgentFile(folder, file);

          if (type === "persona") {
            const personaArtifact = parsePersonaArtifact(raw);

            allArtifacts.push({
              id: personaArtifact.id,
              type,
              description: personaArtifact.description || "",
              content: personaArtifact.content.trim(),
              model: personaArtifact.model,
              name: personaArtifact.name,
              language: personaArtifact.language || "English",
              tone: personaArtifact.tone || "Neutral",
              accent: personaArtifact.accent || "Standard",
            });
          } else if (type === "writer") {
            const writerArtifact = parseWriterArtifact(raw);

            allArtifacts.push({
              type,
              content: writerArtifact.content,
              description: writerArtifact.description,
              id: writerArtifact.id,
              model: writerArtifact.model,
            });
          } else {
            const assemblerArtifact = parseAssemblerArtifact(raw);

            allArtifacts.push({
              type,
              content: assemblerArtifact.content,
              description: assemblerArtifact.description,
              id: assemblerArtifact.id,
              model: assemblerArtifact.model,
              writerIds: assemblerArtifact.writerIds,
            } as AssemblerArtifact);
          }
        }
      }
    } catch (e: any) {
      await LoggerService.warn("Registry scanning failed", {
        error: e.message,
      });
    }

    return allArtifacts;
  }

  static getCachedArtifacts(): Artifact[] {
    return this.cachedArtifacts;
  }

  static async getAllArtifacts(workspaceRoot: string): Promise<Artifact[]> {
    if (this.cachedArtifacts.length > 0) return this.cachedArtifacts;
    this.cachedArtifacts = await this.sync(workspaceRoot);
    return this.cachedArtifacts;
  }

  static initializeAgents(
    apiKey: string,
    model: string,
    artifacts: Artifact[],
  ): AgentPair[] {
    const agents = artifacts.map((artifact): AgentPair => {
      switch (artifact.type) {
        case "persona":
          return {
            type: "persona",
            artifact: artifact as PersonaArtifact,
            agent: new Persona(
              apiKey,
              artifact.model || model,
              artifact.id,
              artifact.name,
              artifact.description,
              artifact.language,
              artifact.accent,
              artifact.tone,
              artifact.content,
            ),
          };
        case "writer":
          return {
            type: "writer",
            artifact: artifact as WriterArtifact,
            agent: new Writer(
              apiKey,
              artifact.model || model,
              artifact.id,
              artifact.description,
              artifact.content,
            ),
          };
        case "assembler":
          return {
            type: "assembler",
            artifact: artifact as AssemblerArtifact,
            agent: new Assembler(
              apiKey,
              artifact.model || model,
              artifact.id,
              artifact.description,
              artifact.content,
              (artifact as AssemblerArtifact).writerIds,
            ),
          };
      }
    });

    LoggerService.debug(`Initialized ${agents.length} agents from registry.`);
    return agents;
  }

  /**
   * Converts active agents into a detailed Functional Capability Map.
   * This allows the Architect to see the actual strategies available.
   */
  static toManifest(agents: AgentPair[]): string {
    const manifest = {
      personas: agents
        .filter(
          (a): a is Extract<AgentPair, { type: "persona" }> =>
            a.type === "persona",
        )
        .map((a) => ({
          id: a.artifact.id,
          name: a.artifact.name,
          description: a.artifact.description,
          capabilities: {
            tone: a.artifact.tone,
            language: a.artifact.language,
          },
        })),
      writers: agents
        .filter(
          (a): a is Extract<AgentPair, { type: "writer" }> =>
            a.type === "writer",
        )
        .map((a) => ({
          id: a.artifact.id,
          description: a.artifact.description,
        })),
      assemblers: agents
        .filter(
          (a): a is Extract<AgentPair, { type: "assembler" }> =>
            a.type === "assembler",
        )
        .map((a) => ({
          id: a.artifact.id,
          description: a.artifact.description,
          supportedWriters: a.artifact.writerIds,
        })),
    };
    return JSON.stringify(manifest, null, 2);
  }

  static validateIntegrity(agents: AgentPair[]): void {
    const writers = getAgentsByType(agents, "writer");
    const assemblers = getAgentsByType(agents, "assembler");
    const availableWriterIds = new Set(writers.map((w) => w.artifact.id));

    for (const assembler of assemblers) {
      const missing = assembler.artifact.writerIds.filter(
        (id) => !availableWriterIds.has(id),
      );
      if (missing.length > 0) {
        const errorMsg = `Assembler "${assembler.artifact.id}" missing writers: [${missing.join(", ")}]`;
        LoggerService.error("Registry Integrity Error", {
          assemblerId: assembler.artifact.id,
          missing,
        });
        throw new Error(errorMsg);
      }
    }
  }
}

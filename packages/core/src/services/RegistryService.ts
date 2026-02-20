// src/services/RegistryService.ts
import { Assembler } from "../agents/Assembler.js";
import { Persona } from "../agents/Persona.js";
import { Writer } from "../agents/Writer.js";
import { AgentTruth } from "../types/index.js";
import { AgentIdentitySchema, AgentKnowledgeSchema } from "../types/schemas.js";
import { LoggerService } from "./LoggerService.js";

export type ArtifactType = "persona" | "writer" | "assembler";

export interface BaseArtifact {
  id: string;
  type: ArtifactType;
  displayName: string;
  description: string;
  content: string;
  truths: AgentTruth[];
}

export interface PersonaArtifact extends BaseArtifact {
  type: "persona";
  language: string;
  tone: string;
  accent: string;
}

export interface WriterArtifact extends BaseArtifact {
  type: "writer";
}

export interface AssemblerArtifact extends BaseArtifact {
  type: "assembler";
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
  listAgentFolders(typeFolder: string): Promise<string[]>;
  readAgentPackage(
    typeFolder: string,
    folderName: string,
  ): Promise<{
    identity: string;
    behavior: string;
    knowledge: string;
  }>;
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
        const agentFolders = await this.provider.listAgentFolders(folder);

        for (const agentDir of agentFolders) {
          const raw = await this.provider.readAgentPackage(folder, agentDir);
          const identity = AgentIdentitySchema.parse(JSON.parse(raw.identity));
          const knowledge = AgentKnowledgeSchema.parse(
            JSON.parse(raw.knowledge),
          );

          if (type === "persona") {
            allArtifacts.push({
              id: identity.id,
              type,
              description: knowledge.description || "",
              content: raw.behavior,
              displayName: identity.displayName,
              truths: knowledge.truths,
              language: identity.metadata?.language || "English",
              tone: identity.metadata?.tone || "Neutral",
              accent: identity.metadata?.accent || "Standard",
            });
          } else {
            allArtifacts.push({
              type,
              content: raw.behavior,
              description: knowledge.description,
              truths: knowledge.truths,
              id: identity.id,
              displayName: identity.displayName,
            });
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

  static clearCache(): void {
    this.cachedArtifacts = [];
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
              model,
              artifact.id,
              artifact.displayName,
              artifact.description,
              artifact.language,
              artifact.accent,
              artifact.tone,
              artifact.content,
              artifact.truths,
            ),
          };
        case "writer":
          return {
            type: "writer",
            artifact: artifact as WriterArtifact,
            agent: new Writer(
              apiKey,
              model,
              artifact.id,
              artifact.displayName,
              artifact.description,
              artifact.content,
              artifact.truths,
            ),
          };
        case "assembler":
          return {
            type: "assembler",
            artifact: artifact as AssemblerArtifact,
            agent: new Assembler(
              apiKey,
              model,
              artifact.id,
              artifact.displayName,
              artifact.description,
              artifact.content,
              artifact.truths,
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
          description: a.artifact.description,
          capabilities: {
            tone: a.artifact.tone,
            language: a.artifact.language,
            accent: a.artifact.accent,
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
        })),
    };
    return JSON.stringify(manifest, null, 2);
  }

  static validateIntegrity(agents: AgentPair[]): void {
    const writers = getAgentsByType(agents, "writer");
    const assemblers = getAgentsByType(agents, "assembler");
    const personas = getAgentsByType(agents, "persona");

    if (writers.length === 0) {
      const errorMsg = "Registry has an empty list of writers";
      LoggerService.error(`RegistryService: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    if (assemblers.length === 0) {
      const errorMsg = "Registry has an empty list of assemblers";
      LoggerService.error(`RegistryService: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    if (personas.length === 0) {
      const errorMsg = "Registry has an empty list of personas";
      LoggerService.error(`RegistryService: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}

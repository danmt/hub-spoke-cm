// src/services/RegistryService.ts
import { Assembler } from "../agents/Assembler.js";
import { Persona } from "../agents/Persona.js";
import { Writer } from "../agents/Writer.js";
import { AgentTruth } from "../types/index.js";
import { AgentIdentitySchema, AgentKnowledgeSchema } from "../types/schemas.js";
import { IoService } from "./IoService.js";
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
  metadata: {
    language: string;
    tone: string;
    accent: string;
  };
}

export interface WriterArtifact extends BaseArtifact {
  type: "writer";
  metadata?: {};
}

export interface AssemblerArtifact extends BaseArtifact {
  type: "assembler";
  metadata?: {};
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

export class RegistryService {
  private static cachedArtifacts: Artifact[] = [];

  /**
   * Fetches all artifacts from the workspace.
   */
  static async sync(workspaceRoot: string): Promise<Artifact[]> {
    const folders: Record<string, ArtifactType> = {
      personas: "persona",
      writers: "writer",
      assemblers: "assembler",
    };

    const allArtifacts: Artifact[] = [];
    try {
      await LoggerService.debug("Scanning registry folders", { workspaceRoot });

      for (const [folder, type] of Object.entries(folders)) {
        const categoryPath = IoService.join(workspaceRoot, "agents", folder);

        if (!(await IoService.exists(categoryPath))) continue;

        const entries = await IoService.readDir(categoryPath);
        const agentFolders = entries
          .filter((e) => e.isDirectory)
          .map((e) => e.name);

        for (const agentDir of agentFolders) {
          const pkgDir = IoService.join(categoryPath, agentDir);

          const identityPath = IoService.join(pkgDir, "agent.json");
          const behaviorPath = IoService.join(pkgDir, "behavior.md");
          const knowledgePath = IoService.join(pkgDir, "knowledge.json");

          if (
            !(await IoService.exists(identityPath)) ||
            !(await IoService.exists(behaviorPath)) ||
            !(await IoService.exists(knowledgePath))
          ) {
            await LoggerService.warn(
              `Incomplete agent package skipped: ${agentDir}`,
            );
            continue;
          }

          const identityRaw = await IoService.readFile(identityPath);
          const behavior = await IoService.readFile(behaviorPath);
          const knowledgeRaw = await IoService.readFile(knowledgePath);

          const identity = AgentIdentitySchema.parse(JSON.parse(identityRaw));
          const knowledge = AgentKnowledgeSchema.parse(
            JSON.parse(knowledgeRaw),
          );

          if (type === "persona") {
            allArtifacts.push({
              id: identity.id,
              type,
              description: knowledge.description || "",
              content: behavior,
              displayName: identity.displayName,
              truths: knowledge.truths,
              metadata: {
                language: identity.metadata?.language || "English",
                tone: identity.metadata?.tone || "Neutral",
                accent: identity.metadata?.accent || "Standard",
              },
            });
          } else {
            allArtifacts.push({
              type,
              content: behavior,
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
              artifact.metadata.language,
              artifact.metadata.accent,
              artifact.metadata.tone,
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
            tone: a.artifact.metadata.tone,
            language: a.artifact.metadata.language,
            accent: a.artifact.metadata.accent,
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

// src/services/RegistryService.ts
import { existsSync } from "fs";
import fs from "fs/promises";
import matter from "gray-matter";
import path from "path";
import { Assembler } from "../agents/Assembler.js";
import { Persona } from "../agents/Persona.js";
import { Writer } from "../agents/Writer.js";
import { IoService } from "./IoService.js";
import { LoggerService } from "./LoggerService.js";

export type ArtifactType = "persona" | "writer" | "assembler" | "auditor";

export interface BaseArtifact {
  id: string;
  type: ArtifactType;
  description: string;
  content: string;
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

export class RegistryService {
  /**
   * Fetches all artifacts from the workspace.
   */
  static async getAllArtifacts(): Promise<Artifact[]> {
    const folders: Record<string, ArtifactType> = {
      personas: "persona",
      writers: "writer",
      assemblers: "assembler",
      auditors: "auditor",
    };

    const allArtifacts: Artifact[] = [];
    try {
      const workspaceRoot = await IoService.findWorkspaceRoot(process.cwd());
      await LoggerService.debug("Scanning registry folders in workspace", {
        workspaceRoot,
      });

      for (const [folder, type] of Object.entries(folders)) {
        const dir = path.join(workspaceRoot, "agents", folder);
        if (!existsSync(dir)) continue;

        const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
        for (const file of files) {
          const raw = await fs.readFile(path.join(dir, file), "utf-8");
          const { data, content } = matter(raw);
          const id = data.id || path.parse(file).name;

          const base = {
            id,
            type,
            description: data.description || "",
            content: content.trim(),
          };

          await LoggerService.debug(`Loaded artifact: ${type}/${id}`);

          if (type === "persona") {
            allArtifacts.push({
              ...base,
              type: "persona",
              name: data.name || id,
              language: data.language || "English",
              tone: data.tone || "Neutral",
              accent: data.accent || "Standard",
            } as PersonaArtifact);
          } else if (type === "writer") {
            allArtifacts.push({ ...base, type: "writer" } as WriterArtifact);
          } else {
            allArtifacts.push({
              ...base,
              writerIds: data.writerIds || [],
              type: "assembler",
            } as AssemblerArtifact);
          }
        }
      }
    } catch (e: any) {
      await LoggerService.warn("Registry scanning failed or not in workspace", {
        error: e.message,
      });
    }
    return allArtifacts;
  }

  static initializeAgents(artifacts: Artifact[]): AgentPair[] {
    const agents = artifacts.map((artifact): AgentPair => {
      switch (artifact.type) {
        case "persona":
          return {
            type: "persona",
            artifact: artifact as PersonaArtifact,
            agent: new Persona(
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

  static getAgentsByType<T extends AgentPair["type"]>(
    agents: AgentPair[],
    type: T,
  ): Extract<AgentPair, { type: T }>[] {
    return agents.filter((a): a is Extract<AgentPair, { type: T }> =>
      isAgentType(a, type),
    );
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
    const writers = this.getAgentsByType(agents, "writer");
    const assemblers = this.getAgentsByType(agents, "assembler");
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

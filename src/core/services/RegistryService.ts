// src/core/services/RegistryService.ts
import { GoogleGenAI } from "@google/genai";
import { existsSync } from "fs";
import fs from "fs/promises";
import matter from "gray-matter";
import path from "path";
import { GlobalConfig } from "../../utils/config.js";
import { Assembler } from "../agents/Assembler.js";
import { Persona } from "../agents/Persona.js";
import { Writer } from "../agents/Writer.js";
import { IoService } from "./IoService.js";

export type ArtifactType = "persona" | "writer" | "assembler";

export interface BaseArtifact {
  id: string;
  type: ArtifactType; // Discriminator
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
    };

    const allArtifacts: Artifact[] = [];
    try {
      const workspaceRoot = await IoService.findWorkspaceRoot(process.cwd());

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
              type: "assembler",
            } as AssemblerArtifact);
          }
        }
      }
    } catch (e) {
      /* Fallback to empty if not in workspace */
    }
    return allArtifacts;
  }

  static initializeAgents(
    config: GlobalConfig,
    client: GoogleGenAI,
    artifacts: Artifact[],
  ): AgentPair[] {
    return artifacts.map((artifact): AgentPair => {
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
              client,
              config,
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
              client,
              config,
              artifact.id,
              artifact.description,
              artifact.content,
            ),
          };
      }
    });
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
   * Converts a list of artifacts into a JSON manifest for the AI.
   */
  static toManifest(agents: AgentPair[]): string {
    const manifest = {
      personas: agents
        .filter((a) => a.type === "persona")
        .map((a) => ({
          id: a.artifact.id,
          description: a.artifact.description,
        })),
      writers: agents
        .filter((a) => a.type === "writer")
        .map((a) => ({
          id: a.artifact.id,
          description: a.artifact.description,
        })),
      assemblers: agents
        .filter((a) => a.type === "assembler")
        .map((a) => ({
          id: a.artifact.id,
          description: a.artifact.description,
        })),
    };
    return JSON.stringify(manifest, null, 2);
  }
}

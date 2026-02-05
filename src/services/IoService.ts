// src/core/services/IoService.ts
import { existsSync } from "fs";
import fs from "fs/promises";
import matter from "gray-matter";
import path from "path";
import { ContentFrontmatter, FrontmatterSchema } from "../types/index.js";

export class IoService {
  /**
   * Searches up the tree to find the Workspace Root (.hub folder).
   */
  static async findWorkspaceRoot(startDir: string): Promise<string> {
    let current = startDir;
    while (current !== path.parse(current).root) {
      const workspaceMarker = path.join(current, ".hub");
      if (existsSync(workspaceMarker)) {
        return current;
      }
      current = path.dirname(current);
    }
    throw new Error("Not a Hub workspace. Run 'hub init' first.");
  }

  /**
   * Returns all Hub IDs (folder names) present in the workspace posts directory.
   */
  static async findAllHubsInWorkspace(
    workspaceRoot: string,
  ): Promise<string[]> {
    const postsDir = path.join(workspaceRoot, "posts");
    try {
      const entries = await fs.readdir(postsDir, { withFileTypes: true });
      return entries
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);
    } catch (error) {
      return [];
    }
  }

  /**
   * Searches up the tree to find a specific Hub Root (hub.md).
   */
  static async findHubRoot(startDir: string): Promise<string> {
    let current = startDir;
    while (current !== path.parse(current).root) {
      try {
        await fs.access(path.join(current, "hub.md"));
        return current;
      } catch {
        current = path.dirname(current);
      }
    }
    throw new Error("No hub.md found. Are you inside a Hub directory?");
  }

  static async readHubFile(rootDir: string): Promise<string> {
    const filePath = path.join(rootDir, "hub.md");
    return fs.readFile(filePath, "utf-8");
  }

  static async readHubMetadata(rootDir: string): Promise<ContentFrontmatter> {
    const filePath = path.join(rootDir, "hub.md");
    const content = await fs.readFile(filePath, "utf-8");
    const { data } = matter(content);
    return FrontmatterSchema.parse(data);
  }

  static async writeMarkdown(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
  }

  static async getSpokeFiles(rootDir: string): Promise<string[]> {
    const spokesDir = path.join(rootDir, "spokes");
    try {
      const files = await fs.readdir(spokesDir);
      return files.filter((f) => f.endsWith(".md"));
    } catch {
      return [];
    }
  }

  static async createHubDirectory(hubId: string): Promise<string> {
    const dirPath = path.join(process.cwd(), "posts", hubId);
    const spokesPath = path.join(dirPath, "spokes");

    await fs.mkdir(dirPath, { recursive: true });
    await fs.mkdir(spokesPath, { recursive: true });

    await IoService.safeWriteFile(path.join(spokesPath, ".keep"), "");

    return dirPath;
  }

  static async safeWriteFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    await fs.writeFile(filePath, content, "utf-8");
  }

  /**
   * Scaffolds a new workspace structure.
   */
  static async initWorkspace(
    rootDir: string,
    type: "starter" | "blank",
  ): Promise<void> {
    const dirs = [
      ".hub",
      "posts",
      "agents/personas",
      "agents/writers",
      "agents/assemblers",
    ];

    for (const d of dirs) {
      await fs.mkdir(path.join(rootDir, d), { recursive: true });
    }

    if (type === "starter") {
      await this.seedStarterArtifacts(rootDir);
    }
  }

  private static async seedStarterArtifacts(rootDir: string) {
    const standardPersona = `---
id: "standard"
name: "Standard"
description: "Neutral, professional, and highly clear."
language: "English"
tone: "Professional, Objective, Concise"
accent: "Neutral / Standard."
---
You are a professional Technical Writer focused on clarity and formal documentation.`;

    const tutorialAssembler = `---
id: "tutorial"
type: "assembler"
description: "Step-by-step learning path."
writerIds:
  - code
  - prose
---

Focus on a logical progression from prerequisites to a working final product. If the topic involves multiple stacks, create dedicated implementation sections for each.`;

    const proseWriter = `---
id: "prose"
type: "writer"
description: "General narrative writing strategy."
---
Focus on narrative flow, clarity, and transitions. Avoid code blocks unless absolutely necessary to illustrate a point. Ensure the tone remains consistent with the chosen Persona.`;

    const codeWriter = `---
id: "code"
type: "writer"
description: "Technical writing strategy."
---

Prioritize technical implementation. Provide clean, production-ready code blocks. Ensure all code comments and explanations are in the target language. Ensure the tone remains consistent with the chosen Persona.`;

    await this.safeWriteFile(
      path.join(rootDir, "agents/personas/standard.md"),
      standardPersona,
    );
    await this.safeWriteFile(
      path.join(rootDir, "agents/assemblers/tutorial.md"),
      tutorialAssembler,
    );
    await this.safeWriteFile(
      path.join(rootDir, "agents/writers/prose.md"),
      proseWriter,
    );
    await this.safeWriteFile(
      path.join(rootDir, "agents/writers/code.md"),
      codeWriter,
    );
  }
}

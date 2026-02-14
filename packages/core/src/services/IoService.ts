// packages/core/src/services/IoService.ts
import matter from "gray-matter";
import { ContentFrontmatter, FrontmatterSchema } from "../types/index.js";

export interface HubContext {
  rootDir: string;
  hubId: string;
}

export interface IoProvider {
  join(...parts: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;
  resolve(...parts: string[]): string;
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readDir(path: string): Promise<{ name: string; isDirectory: boolean }[]>;
  makeDir(path: string, recursive?: boolean): Promise<void>;
}

export class IoService {
  private static provider: IoProvider;

  static setProvider(provider: IoProvider): void {
    this.provider = provider;
  }

  private static ensureProvider() {
    if (!this.provider) {
      throw new Error(
        "IoService: IoProvider not registered. Please call setProvider first.",
      );
    }
  }

  /**
   * Checks if a specific directory is the root of a Hub (contains hub.md).
   */
  static async isHubDirectory(dir: string): Promise<boolean> {
    this.ensureProvider();
    return this.provider.exists(this.provider.join(dir, "hub.md"));
  }

  /**
   * Searches up the tree to find the Workspace Root (.hub folder).
   */
  static async findWorkspaceRoot(startDir: string): Promise<string> {
    this.ensureProvider();
    let current = this.provider.resolve(startDir);

    // Logic: walk up until we find the .hub marker or hit system root
    while (current) {
      const workspaceMarker = this.provider.join(current, ".hub");
      if (await this.provider.exists(workspaceMarker)) {
        return current;
      }
      const parent = this.provider.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    throw new Error("Not a Hub workspace. Run 'hub init' first.");
  }

  /**
   * Returns all Hub IDs present in the workspace posts directory.
   */
  static async findAllHubsInWorkspace(
    workspaceRoot: string,
  ): Promise<string[]> {
    this.ensureProvider();
    const postsDir = this.provider.join(workspaceRoot, "posts");
    try {
      const entries = await this.provider.readDir(postsDir);
      return entries.filter((e) => e.isDirectory).map((e) => e.name);
    } catch {
      return [];
    }
  }

  static async readHubMetadata(
    hubRootDir: string,
  ): Promise<ContentFrontmatter> {
    this.ensureProvider();
    const filePath = this.provider.join(hubRootDir, "hub.md");
    const content = await this.provider.readFile(filePath);
    const { data } = matter(content);
    return FrontmatterSchema.parse(data);
  }

  static async writeMarkdown(filePath: string, content: string): Promise<void> {
    this.ensureProvider();
    await this.provider.writeFile(filePath, content);
  }

  static async createHubDirectory(
    workspaceRoot: string,
    hubId: string,
  ): Promise<string> {
    this.ensureProvider();
    const dirPath = this.provider.join(workspaceRoot, "posts", hubId);
    await this.provider.makeDir(dirPath, true);
    return dirPath;
  }

  /**
   * Scaffolds a new workspace structure.
   */
  static async initWorkspace(
    rootDir: string,
    type: "starter" | "blank",
  ): Promise<void> {
    this.ensureProvider();
    const dirs = [
      ".hub",
      ".hub/logs",
      "posts",
      "agents",
      "agents/personas",
      "agents/writers",
      "agents/assemblers",
      "output",
    ];

    for (const d of dirs) {
      await this.provider.makeDir(this.provider.join(rootDir, d), true);
    }

    await this.provider.writeFile(
      this.provider.join(rootDir, "output/.keep"),
      "",
    );

    if (type === "starter") {
      await this.seedStarterArtifacts(rootDir);
    }
  }

  /**
   * Detects hub context starting from a specific directory.
   */
  static async detectCurrentHub(startDir: string): Promise<HubContext | null> {
    this.ensureProvider();
    try {
      let current = this.provider.resolve(startDir);
      while (current) {
        if (await this.isHubDirectory(current)) {
          return {
            rootDir: current,
            hubId: this.provider.basename(current),
          };
        }
        const parent = this.provider.dirname(current);
        if (parent === current) break;
        current = parent;
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Resolves context using provided workspaceRoot and startDir.
   */
  static async resolveHubContext(
    workspaceRoot: string,
    startDir: string,
    picker: (hubs: string[]) => Promise<string>,
  ): Promise<HubContext> {
    const current = await this.detectCurrentHub(startDir);
    if (current) return current;

    const hubs = await IoService.findAllHubsInWorkspace(workspaceRoot);
    if (hubs.length === 0) {
      throw new Error("No hubs found in workspace. Create one with 'hub new'.");
    }

    const selectedId = await picker(hubs);
    return {
      rootDir: this.provider.join(workspaceRoot, "posts", selectedId),
      hubId: selectedId,
    };
  }

  static async safeWriteFile(filePath: string, content: string): Promise<void> {
    this.ensureProvider();
    const dir = this.provider.dirname(filePath);

    if (!(await this.provider.exists(dir))) {
      await this.provider.makeDir(dir, true);
    }

    await this.provider.writeFile(filePath, content);
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
  - prose
---

Focus on a logical progression from prerequisites to a working final product. If the topic involves multiple stacks, create dedicated implementation sections for each.`;

    const proseWriter = `---
id: "prose"
type: "writer"
description: "General narrative writing strategy."
---
Focus on narrative flow, clarity, and transitions. Avoid code blocks unless absolutely necessary to illustrate a point. Ensure the tone remains consistent with the chosen Persona.`;

    await this.provider.writeFile(
      this.provider.join(rootDir, "agents/personas/standard.md"),
      standardPersona,
    );
    await this.provider.writeFile(
      this.provider.join(rootDir, "agents/assemblers/tutorial.md"),
      tutorialAssembler,
    );
    await this.provider.writeFile(
      this.provider.join(rootDir, "agents/writers/prose.md"),
      proseWriter,
    );

    const gitignore = ".hub/tmp/*\n.hub/logs/*\noutput/*\n!output/.keep";
    await this.provider.writeFile(
      this.provider.join(rootDir, ".gitignore"),
      gitignore,
    );
  }
}

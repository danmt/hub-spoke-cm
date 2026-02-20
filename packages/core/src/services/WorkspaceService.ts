import { WorkspaceManifest } from "../types/index.js";
import { HubService } from "./HubService.js";
import { IoService } from "./IoService.js";
import { RegistryService } from "./RegistryService.js";

export class WorkspaceService {
  /**
   * Scaffolds the top-level workspace structure.
   */
  static async init(rootDir: string, type: "starter" | "blank"): Promise<void> {
    const dirs = [
      ".hub",
      ".hub/logs",
      "posts",
      "agents/personas",
      "agents/writers",
      "agents/assemblers",
      "output",
    ];

    for (const d of dirs) {
      await IoService.makeDir(IoService.join(rootDir, d));
    }

    await IoService.writeFile(IoService.join(rootDir, "output/.keep"), "");

    // Seeding logic for starter agents moves here
    if (type === "starter") {
      await this.seedStarterAgents(rootDir);
    }

    const gitignore = ".hub/tmp/*\n.hub/logs/*\noutput/*\n!output/.keep";
    await IoService.writeFile(IoService.join(rootDir, ".gitignore"), gitignore);
  }

  /**
   * Searches upward from a starting path to find the workspace root (.hub marker).
   */
  static async findRoot(startDir: string): Promise<string> {
    let current = IoService.resolve(startDir);
    while (current) {
      const marker = IoService.join(current, ".hub");
      if (await IoService.exists(marker)) return current;
      const parent = IoService.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    throw new Error("Not a Hub workspace. Run 'hub init' first.");
  }

  /**
   * Generates the Shadow Index (Manifest) by crawling the filesystem.
   */
  static async index(workspaceRoot: string): Promise<WorkspaceManifest> {
    const artifacts = await RegistryService.getAllArtifacts(workspaceRoot);
    const agentEntries = artifacts.map((a) => ({
      id: a.id,
      type: a.type,
      displayName: a.displayName,
      description: a.description,
    }));

    const hubIds = await HubService.listHubs(workspaceRoot);
    const hubEntries = await Promise.all(
      hubIds.map(async (hubId) => {
        const hubRootDir = IoService.join(workspaceRoot, "posts", hubId);
        const parsed = await HubService.readHub(hubRootDir);
        return {
          id: hubId,
          title: parsed.frontmatter.title,
          hasTodo: />\s*\*\*?TODO:?\*?\s*/i.test(parsed.content),
          lastModified: new Date().toISOString(),
        };
      }),
    );

    const manifest: WorkspaceManifest = {
      hubs: hubEntries,
      agents: agentEntries,
      lastSynced: new Date().toISOString(),
    };

    const path = IoService.join(workspaceRoot, ".hub", "workspace.json");
    await IoService.writeFile(path, JSON.stringify(manifest, null, 2));

    return manifest;
  }

  private static async seedStarterAgents(rootDir: string) {
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

    await IoService.writeFile(
      IoService.join(rootDir, "agents/personas/standard.md"),
      standardPersona,
    );
    await IoService.writeFile(
      IoService.join(rootDir, "agents/assemblers/tutorial.md"),
      tutorialAssembler,
    );
    await IoService.writeFile(
      IoService.join(rootDir, "agents/writers/prose.md"),
      proseWriter,
    );

    const gitignore = ".hub/tmp/*\n.hub/logs/*\noutput/*\n!output/.keep";
    await IoService.writeFile(IoService.join(rootDir, ".gitignore"), gitignore);
  }
}

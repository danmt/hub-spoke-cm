// packages/core/src/services/WorkspaceService.ts
import * as crypto from "crypto";
import { WorkspaceManifest } from "../types/index.js";
import { HubService } from "./HubService.js";
import { IoService } from "./IoService.js";
import { RegistryService } from "./RegistryService.js";

export class WorkspaceService {
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

    if (type === "starter") {
      await this.seedStarterAgents(rootDir);
    }

    const gitignore = ".hub/tmp/*\n.hub/logs/*\noutput/*\n!output/.keep";
    await IoService.writeFile(IoService.join(rootDir, ".gitignore"), gitignore);
  }

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
        const state = await HubService.readHub(hubRootDir);

        // Check if any block in the AST is still pending
        const hasTodo = state.sections.some((section) =>
          section.blocks.some((block) => block.status === "pending"),
        );

        return {
          id: hubId,
          title: state.title,
          hasTodo,
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
    const uuid = () => crypto.randomUUID();

    // Persona: Standard
    const pId = uuid();
    const pDir = IoService.join(rootDir, "agents/personas/standard");
    await IoService.makeDir(pDir);
    await IoService.writeFile(
      IoService.join(pDir, "agent.json"),
      JSON.stringify(
        {
          id: pId,
          type: "persona",
          displayName: "Standard",
          metadata: {
            language: "English",
            tone: "Professional",
            accent: "Neutral",
          },
        },
        null,
        2,
      ),
    );
    await IoService.writeFile(
      IoService.join(pDir, "behavior.md"),
      "You are a professional Technical Writer focused on clarity and formal documentation.",
    );
    await IoService.writeFile(
      IoService.join(pDir, "knowledge.json"),
      JSON.stringify(
        { description: "Neutral, professional, and highly clear.", truths: [] },
        null,
        2,
      ),
    );

    // Outliner Assembler
    const oId = uuid();
    const oDir = IoService.join(rootDir, "agents/assemblers/outliner");
    await IoService.makeDir(oDir);
    await IoService.writeFile(
      IoService.join(oDir, "agent.json"),
      JSON.stringify(
        {
          id: oId,
          type: "assembler",
          displayName: "Default Outliner",
          metadata: { role: "outline" },
        },
        null,
        2,
      ),
    );
    await IoService.writeFile(
      IoService.join(oDir, "behavior.md"),
      "Focus on a logical progression from prerequisites to a working final product.",
    );
    await IoService.writeFile(
      IoService.join(oDir, "knowledge.json"),
      JSON.stringify(
        { description: "Standard document structurer.", truths: [] },
        null,
        2,
      ),
    );

    // Block Assembler
    const bId = uuid();
    const bDir = IoService.join(rootDir, "agents/assemblers/delegator");
    await IoService.makeDir(bDir);
    await IoService.writeFile(
      IoService.join(bDir, "agent.json"),
      JSON.stringify(
        {
          id: bId,
          type: "assembler",
          displayName: "Standard Delegator",
          metadata: { role: "block" },
        },
        null,
        2,
      ),
    );
    await IoService.writeFile(
      IoService.join(bDir, "behavior.md"),
      "Break down sections into logical, standalone tasks.",
    );
    await IoService.writeFile(
      IoService.join(bDir, "knowledge.json"),
      JSON.stringify(
        { description: "Micro-task delegator.", truths: [] },
        null,
        2,
      ),
    );

    // Writer: Prose
    const wId = uuid();
    const wDir = IoService.join(rootDir, "agents/writers/prose");
    await IoService.makeDir(wDir);
    await IoService.writeFile(
      IoService.join(wDir, "agent.json"),
      JSON.stringify(
        { id: wId, type: "writer", displayName: "Prose Writer" },
        null,
        2,
      ),
    );
    await IoService.writeFile(
      IoService.join(wDir, "behavior.md"),
      "Focus on narrative flow, clarity, and transitions. Avoid code blocks unless absolutely necessary.",
    );
    await IoService.writeFile(
      IoService.join(wDir, "knowledge.json"),
      JSON.stringify(
        { description: "General narrative writing strategy.", truths: [] },
        null,
        2,
      ),
    );
  }
}

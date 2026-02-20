// packages/cli/src/services/NodeRegistryProvider.ts
import { RegistryProvider } from "@hub-spoke/core";
import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";

export class NodeRegistryProvider implements RegistryProvider {
  constructor(private workspaceRoot: string) {}

  /**
   * Scans a specific agent category (e.g., 'personas') for subdirectories.
   * Each subdirectory represents a single adaptive agent package.
   */
  async listAgentFolders(typeFolder: string): Promise<string[]> {
    const dir = path.join(this.workspaceRoot, "agents", typeFolder);

    if (!existsSync(dir)) {
      return [];
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });

    // Only return names of directories, ignoring legacy standalone .md files
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  }

  /**
   * Reads the three primary components of an agent package required for registry sync.
   * Core logic handles the JSON parsing and schema validation.
   */
  async readAgentPackage(
    typeFolder: string,
    folderName: string,
  ): Promise<{
    identity: string;
    behavior: string;
    knowledge: string;
  }> {
    const pkgDir = path.join(
      this.workspaceRoot,
      "agents",
      typeFolder,
      folderName,
    );

    const identityPath = path.join(pkgDir, "agent.json");
    const behaviorPath = path.join(pkgDir, "behavior.md");
    const knowledgePath = path.join(pkgDir, "knowledge.json");

    // Ensure the package is complete before attempting to load
    if (
      !existsSync(identityPath) ||
      !existsSync(behaviorPath) ||
      !existsSync(knowledgePath)
    ) {
      throw new Error(
        `Incomplete agent package detected in ${typeFolder}/${folderName}. ` +
          `Ensure agent.json, behavior.md, and knowledge.json exist.`,
      );
    }

    return {
      identity: await fs.readFile(identityPath, "utf-8"),
      behavior: await fs.readFile(behaviorPath, "utf-8"),
      knowledge: await fs.readFile(knowledgePath, "utf-8"),
    };
  }

  getIdentifier(file: string): string {
    return path.parse(file).name;
  }

  setWorkspaceRoot(path: string): void {
    this.workspaceRoot = path;
  }
}

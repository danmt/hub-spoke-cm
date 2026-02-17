// packages/cli/src/services/NodeRegistryProvider.ts
import { RegistryProvider } from "@hub-spoke/core";
import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";

export class NodeRegistryProvider implements RegistryProvider {
  constructor(private workspaceRoot: string) {}

  async listAgentFiles(folder: string): Promise<string[]> {
    const dir = path.join(this.workspaceRoot, "agents", folder);
    if (!existsSync(dir)) return [];
    return fs.readdir(dir);
  }

  async readAgentFile(folder: string, filename: string): Promise<string> {
    const filePath = path.join(this.workspaceRoot, "agents", folder, filename);
    return fs.readFile(filePath, "utf-8");
  }

  getIdentifier(file: string): string {
    return path.parse(file).name;
  }

  setWorkspaceRoot(path: string): void {
    this.workspaceRoot = path;
  }
}

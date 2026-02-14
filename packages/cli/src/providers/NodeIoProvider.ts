// src/providers/NodeIoProvider.ts
import { IoProvider } from "@hub-spoke/core";
import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";

export class NodeIoProvider implements IoProvider {
  join(...parts: string[]): string {
    return path.join(...parts);
  }

  dirname(p: string): string {
    return path.dirname(p);
  }

  basename(p: string): string {
    return path.basename(p);
  }

  resolve(...parts: string[]): string {
    return path.resolve(...parts);
  }

  async exists(p: string): Promise<boolean> {
    return existsSync(p);
  }

  async readFile(p: string): Promise<string> {
    return await fs.readFile(p, "utf-8");
  }

  async writeFile(p: string, content: string) {
    await fs.writeFile(p, content, "utf-8");
  }

  async readDir(p: string) {
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
    }));
  }

  async makeDir(p: string, recursive = true): Promise<void> {
    await fs.mkdir(p, { recursive });
  }
}

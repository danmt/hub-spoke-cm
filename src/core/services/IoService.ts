// src/core/services/IoService.ts
import fs from "fs/promises";
import matter from "gray-matter";
import path from "path";
import { ContentFrontmatter, FrontmatterSchema } from "../../types/index.js";

export class IoService {
  /**
   * Searches up the tree to find the Hub Root (hub.md).
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
    const dirPath = path.join(process.cwd(), hubId);
    const spokesPath = path.join(dirPath, "spokes");

    await fs.mkdir(dirPath, { recursive: true });
    await fs.mkdir(spokesPath, { recursive: true });

    return dirPath;
  }

  static async safeWriteFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, "utf-8");
  }
}

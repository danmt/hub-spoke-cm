import fs from "fs/promises";
import matter from "gray-matter";
import path from "path";
import { ContentFrontmatter, FrontmatterSchema } from "../types/index.js";

/**
 * recursively searches up the directory tree to find the Hub Root
 */
export async function findHubRoot(startDir: string): Promise<string> {
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

/**
 * Reads the raw string content of hub.md
 */
export async function readHubFile(rootDir: string): Promise<string> {
  const filePath = path.join(rootDir, "hub.md");
  return fs.readFile(filePath, "utf-8");
}

/**
 * Reads JUST the frontmatter metadata from hub.md
 * This replaces "readAnatomy"
 */
export async function readHubMetadata(
  rootDir: string,
): Promise<ContentFrontmatter> {
  const content = await readHubFile(rootDir);
  const { data } = matter(content);
  return FrontmatterSchema.parse(data);
}

/**
 * Scaffolds the directory structure
 */
export async function createHubDirectory(hubId: string): Promise<string> {
  const dirPath = path.join(process.cwd(), hubId);
  const spokesPath = path.join(dirPath, "spokes");

  await fs.mkdir(dirPath, { recursive: true });
  await fs.mkdir(spokesPath, { recursive: true });

  return dirPath;
}

/**
 * Helper to write file content safely
 */
export async function safeWriteFile(
  filePath: string,
  content: string,
): Promise<void> {
  await fs.writeFile(filePath, content, "utf-8");
}

import fs from "fs/promises";
import path from "path";
import { AnatomySchema, HubAnatomy } from "../types/index.js";

/**
 * Recursively searches up the directory tree to find the nearest 'anatomy.json'.
 * Used to establish the Hub Context even if the user is deep in a subdirectory.
 */
export async function findHubRoot(
  startDir: string = process.cwd(),
): Promise<string> {
  const anatomyPath = path.join(startDir, "anatomy.json");

  try {
    await fs.access(anatomyPath);
    return startDir;
  } catch {
    const parent = path.dirname(startDir);
    if (parent === startDir) {
      throw new Error(
        "No anatomy.json found in this directory or any parent directories.",
      );
    }
    return findHubRoot(parent);
  }
}

/**
 * Reads and validates the anatomy.json file.
 */
export async function readAnatomy(hubDir: string): Promise<HubAnatomy> {
  const filePath = path.join(hubDir, "anatomy.json");
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(content);
    return AnatomySchema.parse(json);
  } catch (error) {
    throw new Error(
      `Failed to read or parse anatomy.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Reads the main hub.md file.
 */
export async function readHubFile(hubDir: string): Promise<string> {
  const filePath = path.join(hubDir, "hub.md");
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to read hub.md: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * specific helper to write files safely (ensuring directories exist).
 */
export async function safeWriteFile(
  filePath: string,
  content: string,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

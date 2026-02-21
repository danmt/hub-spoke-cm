import { IoService } from "./IoService.js";
import { ParserService } from "./ParserService.js";

export interface HubContext {
  rootDir: string;
  hubId: string;
}

export class HubService {
  /**
   * Lists all hub directory names inside /posts.
   */
  static async listHubs(workspaceRoot: string): Promise<string[]> {
    const postsDir = IoService.join(workspaceRoot, "posts");
    if (!(await IoService.exists(postsDir))) return [];

    const entries = await IoService.readDir(postsDir);
    return entries.filter((e) => e.isDirectory).map((e) => e.name);
  }

  /**
   * Reads, parses, and returns the contents of a hub.md file.
   */
  static async readHub(hubRootDir: string) {
    const filePath = IoService.join(hubRootDir, "hub.md");
    const content = await IoService.readFile(filePath);
    return ParserService.parseMarkdown(content);
  }

  static async createHubDirectory(
    workspaceRoot: string,
    hubId: string,
  ): Promise<string> {
    const dirPath = IoService.join(workspaceRoot, "posts", hubId);
    const blocksPath = IoService.join(dirPath, "blocks");

    await IoService.makeDir(dirPath);
    await IoService.makeDir(blocksPath); // Scaffold blocks directory

    return dirPath;
  }

  static async readHubState(hubRootDir: string) {
    const filePath = IoService.join(hubRootDir, "hub.json");
    const content = await IoService.readFile(filePath);
    return JSON.parse(content); // Validate with HubStateSchema later
  }

  /**
   * Detects if the current directory or any parent is a Hub directory.
   */
  static async detectCurrentHub(startDir: string): Promise<HubContext | null> {
    let current = IoService.resolve(startDir);
    while (current) {
      const hubFile = IoService.join(current, "hub.md");
      if (await IoService.exists(hubFile)) {
        return {
          rootDir: current,
          hubId: IoService.basename(current),
        };
      }
      const parent = IoService.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return null;
  }

  /**
   * High-level resolver: automatically finds the active Hub or
   * provides a list for the user to choose from.
   */
  static async resolveHubContext(
    workspaceRoot: string,
    startDir: string,
    picker: (hubs: string[]) => Promise<string>,
  ): Promise<HubContext> {
    // 1. Try to auto-detect based on folder location
    const current = await this.detectCurrentHub(startDir);
    if (current) return current;

    // 2. Fallback to manual selection from all available hubs
    const hubs = await this.listHubs(workspaceRoot);
    if (hubs.length === 0) {
      throw new Error("No hubs found in workspace. Create one with 'hub new'.");
    }

    const selectedId = await picker(hubs);
    return {
      rootDir: IoService.join(workspaceRoot, "posts", selectedId),
      hubId: selectedId,
    };
  }
}

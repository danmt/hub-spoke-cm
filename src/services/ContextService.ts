// src/services/ContextService.ts
import path from "path";
import { IoService } from "./IoService.js";

export interface HubContext {
  rootDir: string;
  hubId: string;
}

export class ContextService {
  /**
   * Attempts to find a Hub context based on current directory.
   * Returns null if not inside a Hub.
   */
  static async detectCurrentHub(): Promise<HubContext | null> {
    try {
      let current = process.cwd();
      while (current !== path.parse(current).root) {
        if (await IoService.isHubDirectory(current)) {
          return {
            rootDir: current,
            hubId: path.basename(current),
          };
        }
        current = path.dirname(current);
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Resolves the target Hub by checking context first,
   * then falling back to a provided picker.
   */
  static async resolveHubContext(
    workspaceRoot: string,
    picker: (hubs: string[]) => Promise<string>,
  ): Promise<HubContext> {
    const current = await this.detectCurrentHub();
    if (current) return current;

    const hubs = await IoService.findAllHubsInWorkspace(workspaceRoot);
    if (hubs.length === 0) {
      throw new Error("No hubs found in workspace. Create one with 'hub new'.");
    }

    const selectedId = await picker(hubs);
    return {
      rootDir: path.join(workspaceRoot, "posts", selectedId),
      hubId: selectedId,
    };
  }
}

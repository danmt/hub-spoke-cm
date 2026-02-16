import { RegistryProvider, RegistryService } from "@hub-spoke/core";
import { Directory, Paths } from "expo-file-system";
import { WorkspaceStorage } from "./WorkspaceStorage";

export class WorkspaceManager {
  /**
   * Orchestrates the switching of a workspace by updating storage and
   * configuring core services with provided (injected) implementation details.
   */
  static async switchWorkspace(
    workspaceId: string | undefined,
    providers: { registry: RegistryProvider },
  ) {
    await WorkspaceStorage.setActiveWorkspace(workspaceId);
    RegistryService.setProvider(providers.registry);
  }

  /**
   * Pure utility to resolve the workspace path.
   */
  static getWorkspaceUri(workspaceId?: string): Directory {
    if (!workspaceId) return Paths.document;
    return new Directory(Paths.document, "workspaces", workspaceId);
  }

  static listWorkspaces(): string[] {
    const wsDir = new Directory(Paths.document, "workspaces");
    if (!wsDir.exists) {
      wsDir.create();
      return [];
    }
    return wsDir
      .list()
      .filter((item) => item instanceof Directory)
      .map((dir) => dir.name);
  }

  static async deleteWorkspace(uri: string): Promise<void> {
    const dir = new Directory(uri);
    if (!dir.exists) return;

    const items = dir.list();
    for (const item of items) {
      if (item instanceof Directory) {
        await this.deleteRecursively(item.uri);
      } else {
        item.delete();
      }
    }
    dir.delete();
  }

  static async deleteRecursively(uri: string): Promise<void> {
    const dir = new Directory(uri);
    if (!dir.exists) return;

    const items = dir.list();
    for (const item of items) {
      if (item instanceof Directory) {
        await this.deleteRecursively(item.uri);
      } else {
        item.delete();
      }
    }
    dir.delete();
  }
}

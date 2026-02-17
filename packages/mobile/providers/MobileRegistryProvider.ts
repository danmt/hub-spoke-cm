import { RegistryProvider } from "@hub-spoke/core";
import { Directory, File, Paths } from "expo-file-system";

export class MobileRegistryProvider implements RegistryProvider {
  /**
   * @param workspaceRoot - The absolute URI of the active workspace.
   */
  constructor(private workspaceRoot: string = Paths.document.uri) {}

  /**
   * Lists files in the specified agent folder.
   * Core expects filenames (e.g., "tutorial.md"), not absolute URIs.
   */
  async listAgentFiles(folder: string): Promise<string[]> {
    const agentsDir = new Directory(this.workspaceRoot, "agents", folder);

    // Idempotent check for directory existence
    if (!agentsDir.exists) {
      return [];
    }

    // .list() returns an array of File/Directory objects.
    // We filter specifically for Files so the RegistryService doesn't try
    // to parse folders as markdown agents.
    const contents = agentsDir.list();

    return contents
      .filter((item): item is File => item instanceof File)
      .map((item) => item.name);
  }

  /**
   * Reads a specific file from the agent folder as a UTF-8 string.
   */
  async readAgentFile(folder: string, filename: string): Promise<string> {
    const agentsDir = new Directory(this.workspaceRoot, "agents", folder);
    const file = new File(agentsDir, filename);

    if (!file.exists) {
      throw new Error(`Agent file not found: agents/${folder}/${filename}`);
    }

    // We must await the .text() promise to return the raw content to the RegistryService
    return await file.text();
  }

  /**
   * Gets the identifier (filename without extension).
   * Used as the Agent ID if 'id' is missing in the frontmatter.
   */
  getIdentifier(file: string): string {
    const fileObj = new File(file);
    // Standard Node-like behavior: "tutorial.md" -> "tutorial"
    return fileObj.name.replace(/\.[^/.]+$/, "");
  }

  setWorkspaceRoot(path: string): void {
    this.workspaceRoot = path;
  }
}

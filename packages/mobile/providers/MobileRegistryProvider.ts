// src/services/ExpoRegistryProvider.ts
import { RegistryProvider } from "@hub-spoke/core";
import { Directory, File, Paths } from "expo-file-system";

export class MobileRegistryProvider implements RegistryProvider {
  /**
   * @param workspaceRoot - Usually Paths.document.uri or a subdirectory within it.
   */
  constructor(private workspaceRoot: string = Paths.document.uri) {}

  /**
   * Lists files in the specified agent folder.
   */
  async listAgentFiles(folder: string): Promise<string[]> {
    // Create a Directory object pointing to the agent subfolder
    const dir = new Directory(this.workspaceRoot, "agents", folder);

    if (!dir.exists) {
      return [];
    }

    // .list() returns an array of File and Directory objects
    const contents = dir.list();

    // We filter for Files only (similar to how readdir usually works for flat files)
    // or simply return the names of all entries.
    return contents.map((item) => item.name);
  }

  /**
   * Reads a specific file from the agent folder as a UTF-8 string.
   */
  async readAgentFile(folder: string, filename: string): Promise<string> {
    const file = new File(this.workspaceRoot, "agents", folder, filename);

    if (!file.exists) {
      throw new Error(`Agent file not found: ${filename}`);
    }

    return await file.text();
  }

  /**
   * Gets the identifier (filename without extension).
   */
  getIdentifier(file: string): string {
    const fileObj = new File(file);
    // The new API provides a 'name' (filename.ext)
    // but not a built-in 'stem' (filename) like Python or Node's path.parse.
    // We can use a simple regex or split to mimic path.parse(file).name.
    return fileObj.name.replace(/\.[^/.]+$/, "");
  }
}

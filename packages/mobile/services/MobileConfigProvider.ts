// src/services/ExpoConfigStorage.ts
import { HubConfig } from "@hub-spoke/core";
import { Directory, File, Paths } from "expo-file-system";

export class ExpoConfigStorage {
  /**
   * On mobile, we use the app's internal document directory.
   * We still use a subdirectory to keep things organized.
   */
  private static storageDir = new Directory(Paths.document, "hub-spoke-cm");
  private static fileName = "config.json";

  static getStoragePath(): string {
    // We return the full URI for the config file
    return new File(this.storageDir, this.fileName).uri;
  }

  /**
   * Safely loads the config from disk.
   */
  static async load(): Promise<Partial<HubConfig>> {
    const configFile = new File(this.storageDir, this.fileName);

    if (!configFile.exists) {
      return {};
    }

    try {
      const data = await configFile.text();
      return JSON.parse(data);
    } catch (error) {
      // Return empty if JSON is malformed or unreadable
      return {};
    }
  }

  /**
   * Persists the config to the document directory.
   */
  static async save(config: HubConfig): Promise<void> {
    // Ensure the subdirectory (~/hub-spoke-cm) exists
    if (!this.storageDir.exists) {
      this.storageDir.create();
    }

    const configFile = new File(this.storageDir, this.fileName);

    // Write the JSON string to the file
    configFile.write(JSON.stringify(config, null, 2));
  }
}

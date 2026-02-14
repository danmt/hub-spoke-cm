import { HubConfig } from "@hub-spoke/core";
import { existsSync } from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";

export class NodeConfigStorage {
  // Matches your requested path: ~/.config/hub-spoke-cm/config.json
  private static storageDir = path.join(
    os.homedir(),
    ".config",
    "hub-spoke-cm",
  );
  private static fileName = "config.json";

  static getStoragePath(): string {
    return path.join(this.storageDir, this.fileName);
  }

  /**
   * Safely loads the config from disk.
   * Returns a partial object if the file doesn't exist.
   */
  static async load(): Promise<Partial<HubConfig>> {
    const filePath = this.getStoragePath();

    if (!existsSync(filePath)) {
      return {};
    }

    try {
      const data = await fs.readFile(filePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      // If the JSON is malformed, we return empty so it can be overwritten
      return {};
    }
  }

  /**
   * Persists the config to the user's config directory.
   */
  static async save(config: HubConfig): Promise<void> {
    const filePath = this.getStoragePath();

    // Ensure the directory exists (~/.config/hub-spoke-cm)
    if (!existsSync(this.storageDir)) {
      await fs.mkdir(this.storageDir, { recursive: true });
    }

    await fs.writeFile(filePath, JSON.stringify(config, null, 2), "utf-8");
  }
}

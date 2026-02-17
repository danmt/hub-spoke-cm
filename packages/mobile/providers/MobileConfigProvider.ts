// packages/mobile/services/MobileConfigProvider.ts
import { ConfigProvider, HubConfig } from "@hub-spoke/core";
import { Directory, File, Paths } from "expo-file-system";

export class MobileConfigProvider implements ConfigProvider {
  /**
   * On mobile, we use the app's internal document directory.
   */
  private storageDir = new Directory(Paths.document, "hub-spoke-cm");
  private fileName = "config.json";

  private async ensureDir() {
    if (!this.storageDir.exists) {
      this.storageDir.create();
    }
  }

  /**
   * Loads the global configuration from the mobile filesystem.
   */
  async loadConfig(): Promise<Partial<HubConfig>> {
    const configFile = new File(this.storageDir, this.fileName);

    if (!configFile.exists) {
      return {};
    }

    try {
      const data = await configFile.text();
      return JSON.parse(data);
    } catch (error) {
      // Return empty if JSON is malformed or unreadable to allow default fallback
      return {};
    }
  }

  /**
   * Persists the configuration to the internal document directory.
   */
  async saveConfig(config: HubConfig): Promise<void> {
    await this.ensureDir();
    const configFile = new File(this.storageDir, this.fileName);

    // Validate or merge if necessary, though ConfigService handles most logic
    await configFile.write(JSON.stringify(config, null, 2));
  }

  /**
   * Returns the URI of the configuration file for debugging/tracing.
   */
  getStorageInfo(): string {
    return new File(this.storageDir, this.fileName).uri;
  }
}

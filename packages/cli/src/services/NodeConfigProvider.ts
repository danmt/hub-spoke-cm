// packages/cli/src/services/NodeConfigProvider.ts
import { ConfigProvider, HubConfig } from "@hub-spoke/core";
import { existsSync } from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";

export class NodeConfigProvider implements ConfigProvider {
  private configPath = path.join(
    os.homedir(),
    ".config",
    "hub-spoke-cm",
    "config.json",
  );

  private async ensureDir() {
    const dir = path.dirname(this.configPath);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async loadConfig(): Promise<Partial<HubConfig>> {
    if (!existsSync(this.configPath)) {
      return {};
    }

    try {
      const data = await fs.readFile(this.configPath, "utf-8");

      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async saveConfig(config: HubConfig): Promise<void> {
    await this.ensureDir();
    const currentConfig = await this.loadConfig();

    await fs.writeFile(
      this.configPath,
      JSON.stringify(
        {
          ...currentConfig,
          ...config,
        },
        null,
        2,
      ),
      "utf-8",
    );
  }

  getStorageInfo() {
    return this.configPath;
  }
}

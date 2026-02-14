// packages/core/src/services/ConfigService.ts
import { HubConfig, HubConfigSchema } from "../types/index.js";
import { LoggerService } from "./LoggerService.js";

export interface ConfigProvider {
  loadConfig(): Promise<Partial<HubConfig>>;
  saveConfig(config: HubConfig): Promise<void>;
  getStorageInfo(): string;
}

export class ConfigService {
  private static provider: ConfigProvider | null = null;

  static setProvider(provider: ConfigProvider): void {
    this.provider = provider;
  }

  private static ensureProvider(): ConfigProvider {
    if (!this.provider) {
      throw new Error("ConfigService: ConfigProvider not registered.");
    }
    return this.provider;
  }

  /**
   * Loads config from provider and validates it against the schema.
   */
  static async getConfig(): Promise<HubConfig> {
    const raw = await this.ensureProvider().loadConfig();
    // Use Zod to apply defaults (like gemini-2.0-flash) and validate
    return HubConfigSchema.parse(raw);
  }

  /**
   * Updates specific fields and persists via provider.
   */
  static async updateConfig(changes: Partial<HubConfig>): Promise<HubConfig> {
    const current = await this.getConfig();
    const updated = HubConfigSchema.parse({ ...current, ...changes });
    await this.ensureProvider().saveConfig(updated);
    await LoggerService.info("Global configuration updated.");
    return updated;
  }

  static getStorageInfo(): string {
    const provider = this.ensureProvider();
    return provider.getStorageInfo();
  }
}

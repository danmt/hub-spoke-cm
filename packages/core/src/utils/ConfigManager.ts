import { HubConfig, HubConfigSchema } from "../types/index.js";

export class ConfigManager {
  private currentConfig: HubConfig;

  constructor(initialConfig: Partial<HubConfig> = {}) {
    // Parse ensures defaults are applied and types are correct
    this.currentConfig = HubConfigSchema.parse(initialConfig);
  }

  get config(): HubConfig {
    return this.currentConfig;
  }

  static prepareUpdate(
    current: Partial<HubConfig>,
    changes: Partial<HubConfig>,
  ): HubConfig {
    const combined = { ...current, ...changes };
    // Zod handles the validation and defaults
    return HubConfigSchema.parse(combined);
  }
}

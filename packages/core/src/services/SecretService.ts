// packages/core/src/services/SecretService.ts
import { HubSecret, HubSecretSchema } from "../types/index.js";
import { LoggerService } from "./LoggerService.js";

export interface SecretProvider {
  loadSecret(): Promise<Partial<HubSecret>>;
  saveSecret(config: HubSecret): Promise<void>;
  getStorageInfo(): string;
}

export class SecretService {
  private static provider: SecretProvider | null = null;

  static setProvider(provider: SecretProvider): void {
    this.provider = provider;
  }

  private static ensureProvider(): SecretProvider {
    if (!this.provider) {
      throw new Error("SecretService: SecretProvider not registered.");
    }
    return this.provider;
  }

  /**
   * Loads config from provider and validates it against the schema.
   */
  static async getSecret(): Promise<HubSecret> {
    const raw = await this.ensureProvider().loadSecret();
    // Use Zod to apply defaults (like gemini-2.0-flash) and validate
    return HubSecretSchema.parse(raw);
  }

  /**
   * Updates specific fields and persists via provider.
   */
  static async updateSecret(changes: Partial<HubSecret>): Promise<HubSecret> {
    const current = await this.getSecret();
    const updated = HubSecretSchema.parse({ ...current, ...changes });
    await this.ensureProvider().saveSecret(updated);
    await LoggerService.info("Global configuration updated.");
    return updated;
  }

  static getStorageInfo(): string {
    const provider = this.ensureProvider();
    return provider.getStorageInfo();
  }
}

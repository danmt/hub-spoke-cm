// packages/cli/src/services/NodeSecretProvider.ts
import { HubSecret, SecretProvider } from "@hub-spoke/core";
import { existsSync } from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";

export class NodeSecretProvider implements SecretProvider {
  private secretsPath = path.join(
    os.homedir(),
    ".config",
    "hub-spoke-cm",
    ".secrets",
  );

  private async ensureDir() {
    const dir = path.dirname(this.secretsPath);

    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async loadSecret(): Promise<Partial<HubSecret>> {
    if (!existsSync(this.secretsPath)) {
      return {};
    }

    try {
      const data = await fs.readFile(this.secretsPath, "utf-8");

      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async saveSecret(secret: Partial<HubSecret>): Promise<void> {
    await this.ensureDir();
    const currentSecret = await this.loadSecret();

    await fs.writeFile(
      this.secretsPath,
      JSON.stringify(
        {
          ...currentSecret,
          ...secret,
        },
        null,
        2,
      ),
      {
        mode: 0o600, // Read/Write for owner only - standard security practice
      },
    );
  }

  getStorageInfo() {
    return this.secretsPath;
  }
}

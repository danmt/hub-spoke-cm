// packages/mobile/services/MobileSecretProvider.ts
import { HubSecret, SecretProvider } from "@hub-spoke/core";
import { Directory, File, Paths } from "expo-file-system";

export class MobileSecretProvider implements SecretProvider {
  /**
   * We use a hidden-style filename for the secrets file within the app's
   * internal document directory.
   */
  private storageDir = new Directory(Paths.document, "hub-spoke-cm");
  private fileName = ".secrets.json";

  private async ensureDir() {
    if (!this.storageDir.exists) {
      this.storageDir.create();
    }
  }

  /**
   * Loads the secrets (API Keys) from the mobile internal sandbox.
   */
  async loadSecret(): Promise<Partial<HubSecret>> {
    const secretFile = new File(this.storageDir, this.fileName);

    if (!secretFile.exists) {
      return {};
    }

    try {
      const data = await secretFile.text();
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  /**
   * Persists the secrets. In Expo's FileSystem, files written to the
   * document directory are private to the application.
   */
  async saveSecret(secret: Partial<HubSecret>): Promise<void> {
    await this.ensureDir();

    const current = await this.loadSecret();
    const secretFile = new File(this.storageDir, this.fileName);

    await secretFile.write(
      JSON.stringify(
        {
          ...current,
          ...secret,
        },
        null,
        2,
      ),
    );
  }

  /**
   * Returns the internal URI of the secrets storage.
   */
  getStorageInfo(): string {
    return new File(this.storageDir, this.fileName).uri;
  }
}

// packages/core/src/services/IoService.ts
export interface IoProvider {
  join(...parts: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;
  resolve(...parts: string[]): string;
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readDir(path: string): Promise<{ name: string; isDirectory: boolean }[]>;
  makeDir(path: string, recursive?: boolean): Promise<void>;
}

/**
 * Generic IO Service.
 * Acts as a bridge between Core and the Platform's filesystem.
 */
export class IoService {
  private static provider: IoProvider;

  static setProvider(provider: IoProvider): void {
    this.provider = provider;
  }

  private static ensureProvider(): IoProvider {
    if (!this.provider) {
      throw new Error(
        "IoService: IoProvider not registered. Please call setProvider first.",
      );
    }
    return this.provider;
  }

  static join(...parts: string[]): string {
    return this.ensureProvider().join(...parts);
  }

  static dirname(path: string): string {
    return this.ensureProvider().dirname(path);
  }

  static basename(path: string): string {
    return this.ensureProvider().basename(path);
  }

  static resolve(...parts: string[]): string {
    return this.ensureProvider().resolve(...parts);
  }

  static async exists(path: string): Promise<boolean> {
    return this.ensureProvider().exists(path);
  }

  static async readFile(path: string): Promise<string> {
    return this.ensureProvider().readFile(path);
  }

  static async writeFile(path: string, content: string): Promise<void> {
    const provider = this.ensureProvider();
    const dir = provider.dirname(path);
    if (!(await provider.exists(dir))) {
      await provider.makeDir(dir, true);
    }
    await provider.writeFile(path, content);
  }

  static async readDir(
    path: string,
  ): Promise<{ name: string; isDirectory: boolean }[]> {
    return this.ensureProvider().readDir(path);
  }

  static async makeDir(path: string, recursive = true): Promise<void> {
    await this.ensureProvider().makeDir(path, recursive);
  }
}

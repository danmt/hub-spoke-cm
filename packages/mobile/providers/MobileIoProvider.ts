// packages/mobile/providers/MobileIoProvider.ts
import { IoProvider } from "@hub-spoke/core";
import { Directory, File, Paths } from "expo-file-system";

/**
 * Mobile implementation of the IoProvider using expo-file-system.
 * Optimized for dynamic workspace switching and absolute URI enforcement.
 */
export class MobileIoProvider implements IoProvider {
  /**
   * Joins path parts. If the first part isn't an absolute URI,
   * it defaults to the document directory.
   */
  join(...parts: string[]): string {
    const filtered = parts.filter((p) => p !== "");
    if (filtered.length === 0) return Paths.document.uri;

    // If the first part isn't already a file URI, make it absolute
    const base = filtered[0].startsWith("file://")
      ? filtered[0]
      : `${Paths.document.uri}/${filtered[0]}`;

    return Paths.join(base, ...filtered.slice(1));
  }

  /**
   * Returns the parent directory URI.
   */
  dirname(p: string): string {
    if (!p || p === "" || p === "file:///") return Paths.document.uri;
    const dir = new Directory(p);
    return dir.parentDirectory?.uri ?? p;
  }

  /**
   * Returns the name of the file or directory.
   */
  basename(p: string): string {
    if (!p || p === "") return "";
    return new File(p).name;
  }

  /**
   * Resolves paths into absolute file:// URIs.
   * Defaults to document directory if no valid path is provided.
   */
  resolve(...parts: string[]): string {
    const filtered = parts.filter((p) => p !== "");
    if (filtered.length === 0) return Paths.document.uri;

    const base = filtered[0].startsWith("file://")
      ? filtered[0]
      : Paths.document.uri;
    const extra = filtered[0].startsWith("file://")
      ? filtered.slice(1)
      : filtered;

    return Paths.join(base, ...extra);
  }

  /**
   * Checks if a file or directory exists.
   */
  async exists(p: string): Promise<boolean> {
    if (!p || p === "") return false;
    const file = new File(p);
    const dir = new Directory(p);
    return file.exists || dir.exists;
  }

  /**
   * Reads a file as a UTF-8 string.
   */
  async readFile(p: string): Promise<string> {
    const file = new File(p);
    if (!file.exists) {
      throw new Error(`File not found: ${p}`);
    }
    return await file.text();
  }

  /**
   * Writes content to a file, creating it if necessary.
   */
  async writeFile(p: string, content: string): Promise<void> {
    const file = new File(p);
    const parentDir = file.parentDirectory;

    if (parentDir && !parentDir.exists) {
      parentDir.create();
    }

    if (!file.exists) {
      file.create();
    }
    file.write(content);
  }

  /**
   * Reads directory contents.
   */
  async readDir(p: string) {
    const dir = new Directory(p);
    if (!dir.exists) return [];

    const contents = dir.list();

    return contents.map((item) => ({
      name: item.name,
      isDirectory: item instanceof Directory,
    }));
  }

  /**
   * Creates a directory idempotently.
   */
  async makeDir(p: string, _recursive = true): Promise<void> {
    const dir = new Directory(p);
    if (!dir.exists) {
      dir.create();
    }
  }
}

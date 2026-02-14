import { IoProvider } from "@hub-spoke/core";
import { Directory, File } from "expo-file-system";

/**
 * Mobile implementation of the IoProvider using expo-file-system.
 * Optimized for dynamic workspace switching and idempotent directory creation.
 */
export class MobileIoProvider implements IoProvider {
  /**
   * Joins path parts using the Directory constructor.
   */
  join(...parts: string[]): string {
    if (parts.length === 0) return "";
    // Normalize and join path parts into a URI string
    return new Directory(parts[0], ...parts.slice(1)).uri;
  }

  /**
   * Returns the parent directory URI.
   */
  dirname(p: string): string {
    const dir = new Directory(p);
    return dir.parentDirectory?.uri ?? p;
  }

  /**
   * Returns the name of the file or directory.
   */
  basename(p: string): string {
    // Both File and Directory instances have a 'name' property
    return new File(p).name;
  }

  /**
   * Resolves paths into absolute file:// URIs.
   */
  resolve(...parts: string[]): string {
    return new Directory(...parts).uri;
  }

  /**
   * Checks if a file or directory exists.
   * Updated to check both types to prevent "create" rejections.
   */
  async exists(p: string): Promise<boolean> {
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

    // Ensure the parent directory exists first
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
   * Reads directory contents and maps to the Core interface.
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
   * recursive=true is handled natively by the Directory(path).create() method.
   */
  async makeDir(p: string, _recursive = true): Promise<void> {
    const dir = new Directory(p);

    if (!dir.exists) {
      dir.create();
    }
  }
}

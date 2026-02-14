// src/providers/ExpoIoProvider.ts
import { IoProvider } from "@hub-spoke/core";
import { Directory, File } from "expo-file-system";

export class MobileIoProvider implements IoProvider {
  /**
   * Joins path parts.
   * Expo's new API handles joining via the constructor of File or Directory.
   */
  join(...parts: string[]): string {
    if (parts.length === 0) return "";
    // We can use a Directory object to normalize and join the path string
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
    // Both File and Directory have a 'name' property
    return new File(p).name;
  }

  /**
   * Resolves paths. In mobile filesystems, paths are typically absolute URIs
   * starting with 'file://'.
   */
  resolve(...parts: string[]): string {
    return new Directory(...parts).uri;
  }

  /**
   * Checks if a file or directory exists.
   */
  async exists(p: string): Promise<boolean> {
    const file = new File(p);
    return file.exists;
  }

  /**
   * Reads a file as a UTF-8 string.
   */
  async readFile(p: string): Promise<string> {
    const file = new File(p);
    return await file.text();
  }

  /**
   * Writes content to a file.
   */
  async writeFile(p: string, content: string): Promise<void> {
    const file = new File(p);
    // Note: In some versions, you may need to call file.create() first
    // if the file doesn't exist.
    if (!file.exists) {
      file.create();
    }
    file.write(content);
  }

  /**
   * Reads directory contents and maps to the required interface.
   */
  async readDir(p: string) {
    const dir = new Directory(p);
    const contents = dir.list(); // Returns (File | Directory)[]

    return contents.map((item) => ({
      name: item.name,
      isDirectory: item instanceof Directory,
    }));
  }

  /**
   * Creates a directory.
   * recursive=true is handled automatically by the native implementation
   * when calling .create() on a Directory object.
   */
  async makeDir(p: string, _recursive = true): Promise<void> {
    const dir = new Directory(p);
    if (!dir.exists) {
      dir.create();
    }
  }
}

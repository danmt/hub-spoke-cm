// src/services/ExpoValidationProvider.ts
import { ValidationProvider } from "@hub-spoke/core";
import { File } from "expo-file-system";

export class MobileValidationProvider implements ValidationProvider {
  /**
   * Reads a file as a UTF-8 string using the modern File class.
   */
  async readFile(filePath: string): Promise<string> {
    const file = new File(filePath);

    if (!file.exists) {
      throw new Error(`File not found at: ${filePath}`);
    }

    // .text() is the new standard way to read UTF-8 content asynchronously
    return await file.text();
  }

  /**
   * Extracts the filename including extension from a URI or path.
   */
  basename(filePath: string): string {
    // The File class automatically parses the URI/path provided
    // and exposes the filename via the .name property.
    return new File(filePath).name;
  }
}

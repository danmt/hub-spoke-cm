import { ValidationProvider } from "@hub-spoke/core";
import fs from "fs/promises";
import path from "path";

export class NodeValidationProvider implements ValidationProvider {
  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, "utf-8");
  }

  basename(filePath: string): string {
    return path.basename(filePath);
  }
}

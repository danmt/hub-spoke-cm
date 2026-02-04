import fs from "fs";
import os from "os";
import path from "path";

const CONFIG_DIR = path.join(os.homedir(), ".config", "hub-spoke-cm");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export interface GlobalConfig {
  apiKey?: string;
}

export function getGlobalConfig(): GlobalConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return {};
    }
    const content = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    // If config is corrupt, return empty
    return {};
  }
}

export function setGlobalConfig(key: string, value: string): void {
  // Ensure directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const current = getGlobalConfig();
  const updated = { ...current, [key]: value };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
}

import fs from "fs";
import os from "os";
import path from "path";

const CONFIG_DIR = path.join(os.homedir(), ".config", "hub-spoke-cm");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export interface GlobalConfig {
  apiKey?: string;
  architectModel?: string; // Model for high-level planning (new/spawn)
  writerModel?: string; // Model for prose generation (fill)
}

// Defaults requested
const DEFAULTS: Partial<GlobalConfig> = {
  architectModel: "gemini-3-flash",
  writerModel: "gemini-3-flash",
};

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getGlobalConfig(): GlobalConfig {
  ensureConfigDir();
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return DEFAULTS;
    }
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    const userConfig = JSON.parse(raw);

    // Merge user config with defaults (in case new fields are missing)
    return { ...DEFAULTS, ...userConfig };
  } catch (error) {
    return DEFAULTS;
  }
}

export function setGlobalConfig(newConfig: Partial<GlobalConfig>) {
  ensureConfigDir();
  const current = getGlobalConfig();
  const updated = { ...current, ...newConfig };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

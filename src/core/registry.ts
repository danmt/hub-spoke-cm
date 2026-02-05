// src/core/registry.ts
import { ASSEMBLER_REGISTRY } from "./assemblers/index.js";
import { PERSONA_REGISTRY } from "./personas/index.js";

/**
 * Generates a manifest for the Architect to understand available tools.
 */
export function getAvailableToolsManifest() {
  const assemblers = Object.values(ASSEMBLER_REGISTRY).map((a) => ({
    id: a.id,
    description: a.description,
  }));

  const personas = Object.values(PERSONA_REGISTRY).map((p) => ({
    id: p.id,
    description: p.description,
  }));

  return JSON.stringify({ assemblers, personas }, null, 2);
}

// src/types/index.ts
import { z } from "zod";
import {
  FrontmatterSchema,
  HubBlueprintSchema,
  HubComponentSchema,
  HubConfigSchema,
  SectionBlueprintSchema,
} from "./schemas.js";

// Export Inferred Types
export type SectionBlueprint = z.infer<typeof SectionBlueprintSchema>;
export type HubComponent = z.infer<typeof HubComponentSchema>;
export type ContentFrontmatter = z.infer<typeof FrontmatterSchema>;
export type HubBlueprint = z.infer<typeof HubBlueprintSchema>;
export type HubConfig = z.infer<typeof HubConfigSchema>;

// Re-export Schemas for validation use
export {
  FrontmatterSchema,
  HubBlueprintSchema,
  HubComponentSchema,
  HubConfigSchema,
  SectionBlueprintSchema,
} from "./schemas.js";

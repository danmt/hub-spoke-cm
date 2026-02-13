// src/types/index.ts
import { z } from "zod";
import {
  FrontmatterSchema,
  HubBlueprintSchema,
  HubComponentSchema,
  SectionBlueprintSchema,
} from "./schemas.js";

// Export Inferred Types
export type SectionBlueprint = z.infer<typeof SectionBlueprintSchema>;
export type HubComponent = z.infer<typeof HubComponentSchema>;
export type ContentFrontmatter = z.infer<typeof FrontmatterSchema>;
export type HubBlueprint = z.infer<typeof HubBlueprintSchema>;

// Re-export Schemas for validation use
export {
  FrontmatterSchema,
  HubBlueprintSchema,
  HubComponentSchema,
  SectionBlueprintSchema,
} from "./schemas.js";

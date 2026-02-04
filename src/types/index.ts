import { z } from "zod";
import {
  FrontmatterSchema,
  HubBlueprintSchema,
  HubComponentSchema,
  SectionBlueprintSchema,
} from "./schemas.js";

export type SectionBlueprint = z.infer<typeof SectionBlueprintSchema>;
export type HubComponent = z.infer<typeof HubComponentSchema>;
export type ContentFrontmatter = z.infer<typeof FrontmatterSchema>;
export type HubBlueprint = z.infer<typeof HubBlueprintSchema>;

export {
  FrontmatterSchema,
  HubBlueprintSchema,
  HubComponentSchema,
  SectionBlueprintSchema,
} from "./schemas.js";

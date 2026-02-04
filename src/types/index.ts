import { z } from "zod";
import {
  AnatomySchema,
  ComponentSchema,
  FrontmatterSchema,
} from "./schemas.js";

// Infer TypeScript interfaces from Zod schemas
export type HubAnatomy = z.infer<typeof AnatomySchema>;
export type HubComponent = z.infer<typeof ComponentSchema>;
export type ContentFrontmatter = z.infer<typeof FrontmatterSchema>;

// Helper type for the directory structure context
// Used when passing the "state" of a Hub between CLI commands and the core library
export interface HubContext {
  dir: string;
  anatomy: HubAnatomy;
  hubFileContent: string; // Raw markdown content of hub.md
}

export {
  AnatomySchema,
  ComponentSchema,
  FrontmatterSchema,
} from "./schemas.js";

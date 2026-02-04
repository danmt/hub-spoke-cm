import { z } from "zod";

// 1. Blueprint for Sections (Used by AI generation)
export const SectionBlueprintSchema = z.object({
  header: z.string(),
  intent: z.string(),
});

// 2. Hub Components (Used internally by AI to structure the Hub)
export const HubComponentSchema = SectionBlueprintSchema.extend({
  id: z.string(),
});

// 3. The "Single Source of Truth" Frontmatter
// This now holds the metadata that used to be in anatomy.json
export const FrontmatterSchema = z.object({
  title: z.string(),
  type: z.enum(["hub", "spoke"]),

  // Hub Metadata (Required for Hubs, Optional for Spokes)
  hubId: z.string(),
  goal: z.string().optional(), // Moved from anatomy.json
  audience: z.string().optional(), // Moved from anatomy.json
  language: z.string().default("English"),

  // Spoke Metadata
  componentId: z.string().optional(),

  date: z.string(),
});

// 4. Return type for AI Anatomy Generation (Intermediate, not saved to disk)
export const HubBlueprintSchema = z.object({
  hubId: z.string(),
  components: z.array(HubComponentSchema),
});

import { z } from "zod";

// ==========================================
// 1. Hub Anatomy Schema (anatomy.json)
// Ref: SRS Section 3.1
// ==========================================

export const ComponentSchema = z.object({
  id: z.string().describe("Short code, e.g., 'prep'"),
  header: z.string().describe("Exact H2/H3 text match in hub.md"),
  intent: z.string().describe("Context instructions for the AI"),
});

export const AnatomySchema = z.object({
  hubId: z.string().describe("UUID or Slug"),
  goal: z.string().describe("The master intent of the article"),
  targetAudience: z.string(),
  components: z.array(ComponentSchema),
});

// ==========================================
// 2. Content Frontmatter Schema
// Ref: SRS Section 7 (Astro Integration Specs)
// ==========================================

export const ContentTypeSchema = z.enum(["hub", "spoke"]);

export const FrontmatterSchema = z.object({
  title: z.string(),
  type: ContentTypeSchema,

  // Relationships
  hubId: z.string().optional().describe("Reference to the parent folder"),
  componentId: z
    .string()
    .optional()
    .describe("Links this spoke to a specific section of the Hub"),
  relatedSpokes: z
    .array(z.string())
    .optional()
    .describe("Array of filenames for manual linking"),

  // Versioning
  version: z.string().default("1.0"),
  variant: z.string().optional().describe("e.g., 'es-ar'"),

  // Standard Metadata
  image: z.string().optional(),
  date: z.string().default(() => new Date().toISOString().split("T")[0]),
  author: z.string().optional(),
});

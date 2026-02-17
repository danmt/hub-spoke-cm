import { z } from "zod";

/**
 * 1. Blueprint for Sections
 * Used by Assemblers to define the requirements for each part of the article.
 */
export const SectionBlueprintSchema = z.object({
  id: z.string(),
  header: z.string(),
  intent: z.string(),
  writerId: z.string(),
  bridge: z.string(),
});

/**
 * 2. Hub Components
 * Internal representation of a section within the Hub structure.
 */
export const HubComponentSchema = SectionBlueprintSchema.extend({
  id: z.string(),
});

/**
 * 3. The "Single Source of Truth" Frontmatter
 * This holds the metadata that defines the article's identity, structure, and agentic configuration.
 */
export const FrontmatterSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.literal("hub"),

  // Identity Metadata
  hubId: z.string(),
  topic: z.string(),
  goal: z.string(),
  audience: z.string(),
  language: z.string(),

  // Generation Metadata
  date: z.string(),

  // Agentic Hierarchy Metadata
  assemblerId: z.string(),
  personaId: z.string(),

  // Persists the structural plan
  blueprint: z.record(z.string(), SectionBlueprintSchema),
});

/**
 * 4. Return type for AI Anatomy Generation
 * Used by the Architect and Assemblers to coordinate the initial file scaffolding.
 */
export const HubBlueprintSchema = z.object({
  hubId: z.string(),
  components: z.array(HubComponentSchema),
  // Optional hint if the Architect wants to force a specific Persona based on the interview
  suggestedPersonaId: z.string().optional(),
});

export const HubConfigSchema = z.object({
  model: z.string().default("gemini-2.0-flash").optional(),
});

export const HubSecretSchema = z.object({
  apiKey: z.string().optional(),
});

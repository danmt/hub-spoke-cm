import { z } from "zod";

/**
 * 1. Blueprint for Sections
 * Used by Assemblers to define the requirements for each part of the article.
 */
export const SectionBlueprintSchema = z.object({
  header: z.string(),
  intent: z.string(),
  // Routes the section to a specific specialized Writer class (e.g., 'code', 'prose')
  writerId: z.string().default("prose"),
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
  type: z.enum(["hub", "spoke"]),

  // Identity Metadata
  hubId: z.string(),
  goal: z.string().optional(),
  audience: z.string().optional(),
  language: z.string().default("English"),

  // Spoke Metadata
  componentId: z.string().optional(),

  // Generation Metadata
  date: z.string(),

  // Agentic Hierarchy Metadata ---

  // Tracks which Assembler class was used to generate the structure
  assemblerId: z.string().optional(),

  // Tracks which Persona class provides the 'voice' for this article
  personaId: z.string().default("standard"),

  // Persists the structural plan to provide context for Auditors
  // Maps Header -> { intent, writerId }
  blueprint: z
    .record(
      z.string(),
      z.object({
        intent: z.string(),
        writerId: z.string(),
      }),
    )
    .optional(),

  // A lookup map of "Header Text" -> "WriterId"
  // This allows the 'fill' command to know which Writer strategy to use for each section
  writerMap: z.record(z.string(), z.string()).optional(),
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

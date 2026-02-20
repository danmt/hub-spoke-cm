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
  allowedWriterIds: z.string(),

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

/**
 * The Identity of an agent (agent.json)
 */
export const AgentIdentitySchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["persona", "writer", "assembler"]),
  displayName: z.string(),
  metadata: z.record(z.string(), z.any()).optional(), // e.g., { tone, language } for personas
});

/**
 * Lineage tracking (birth.json)
 */
export const AgentBirthSchema = z.object({
  parentId: z.string().uuid().optional(),
  birthReason: z.string(),
  timestamp: z.string(),
});

/**
 * The Memory of an agent (knowledge.json)
 */
export const AgentTruthSchema = z.object({
  text: z.string(),
  weight: z.number().min(0).max(1),
});

/**
 * The Memory of an agent (knowledge.json)
 */
export const AgentKnowledgeSchema = z.object({
  description: z.string(),
  truths: z.array(AgentTruthSchema).default([]),
});

/**
 * Evolution Proposal
 * Represents a single memory adjustment suggested by the Evolution Engine.
 */
export const EvolutionProposalSchema = z.object({
  text: z.string(),
  action: z.enum(["add", "strengthen", "weaken"]),
  reasoning: z.string(), // Why the AI decided to make this change
});

/**
 * Evolution Analysis
 * The full output from the LLM after analyzing the feedback buffer.
 */
export const EvolutionAnalysisSchema = z.object({
  proposals: z.array(EvolutionProposalSchema),
  thoughtProcess: z.string(), // High-level summary of patterns detected
});

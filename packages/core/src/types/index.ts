// src/types/index.ts
import { z } from "zod";
import {
  AgentBirthSchema,
  AgentIdentitySchema,
  AgentKnowledgeSchema,
  AgentTruthSchema,
  EvolutionAnalysisSchema,
  EvolutionProposalSchema,
  FrontmatterSchema,
  HubBlueprintSchema,
  HubComponentSchema,
  HubConfigSchema,
  HubSecretSchema,
  SectionBlueprintSchema,
} from "./schemas.js";

// Export Inferred Types
export type SectionBlueprint = z.infer<typeof SectionBlueprintSchema>;
export type HubComponent = z.infer<typeof HubComponentSchema>;
export type ContentFrontmatter = z.infer<typeof FrontmatterSchema>;
export type HubBlueprint = z.infer<typeof HubBlueprintSchema>;
export type HubConfig = z.infer<typeof HubConfigSchema>;
export type HubSecret = z.infer<typeof HubSecretSchema>;
export type AgentIdentity = z.infer<typeof AgentIdentitySchema>;
export type AgentBirth = z.infer<typeof AgentBirthSchema>;
export type AgentKnowledge = z.infer<typeof AgentKnowledgeSchema>;
export type AgentTruth = z.infer<typeof AgentTruthSchema>;
export type EvolutionAnalysis = z.infer<typeof EvolutionAnalysisSchema>;
export type EvolutionProposal = z.infer<typeof EvolutionProposalSchema>;

// Re-export Schemas for validation use
export {
  AgentBirthSchema,
  AgentIdentitySchema,
  AgentKnowledgeSchema,
  AgentTruthSchema,
  EvolutionAnalysisSchema,
  EvolutionProposalSchema,
  FrontmatterSchema,
  HubBlueprintSchema,
  HubComponentSchema,
  HubConfigSchema,
  HubSecretSchema,
  SectionBlueprintSchema,
} from "./schemas.js";

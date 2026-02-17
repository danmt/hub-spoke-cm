import { z } from "zod";

/**
 * Metadata for a Hub stored in the local mobile index.
 * Prevents reading/parsing full hub.md files for list views.
 */
export const HubIndexEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  hasTodo: z.boolean(),
  lastModified: z.string(),
});

/**
 * Metadata for an Agent stored in the local mobile index.
 * Allows the Registry list to render without parsing agent frontmatter.
 */
export const AgentIndexEntrySchema = z.object({
  id: z.string(),
  type: z.enum(["persona", "writer", "assembler"]),
  name: z.string().optional(),
  description: z.string(),
});

/**
 * The Mobile Shadow Index (.hub/workspace.json).
 * Unique to the mobile implementation for performance optimization.
 */
export const WorkspaceManifestSchema = z.object({
  hubs: z.array(HubIndexEntrySchema).default([]),
  agents: z.array(AgentIndexEntrySchema).default([]),
  lastSynced: z.string(),
});

export type HubIndexEntry = z.infer<typeof HubIndexEntrySchema>;
export type AgentIndexEntry = z.infer<typeof AgentIndexEntrySchema>;
export type WorkspaceManifest = z.infer<typeof WorkspaceManifestSchema>;

// packages/mobile/services/AgentPersistence.ts
import { ArtifactType } from "@hub-spoke/core";
import { Directory, File } from "expo-file-system";

export interface SaveAgentParams {
  workspaceUri: string;
  type: ArtifactType;
  id: string;
  frontmatter: Record<string, any>;
  content: string; // The system instructions / strategy
}

export class AgentsStorage {
  /**
   * Saves an agent artifact to the mobile filesystem.
   * Bypasses IoService to use native expo-file-system calls.
   */
  static async saveAgentToFile({
    workspaceUri,
    type,
    id,
    frontmatter,
    content,
  }: SaveAgentParams): Promise<string> {
    // 1. Resolve target directory based on type
    const folderName = `${type}s`; // personas, writers, assemblers
    const agentDir = new Directory(workspaceUri, "agents", folderName);

    if (!agentDir.exists) {
      agentDir.create();
    }

    // 2. Generate Markdown using Core Parser
    // Agent artifacts are simpler than Hubs: they just have frontmatter + body.
    // ParserService.reconstructMarkdown expects (frontmatter, sections).
    // We pass an empty sections object because agent bodies are parsed as raw content
    // after the frontmatter block, not delimited sections.
    const markdown = this.generateAgentMarkdown(frontmatter, content);

    // 3. Write to disk
    const filename = `${id}.md`;
    const agentFile = new File(agentDir, filename);

    // Ensure we are using the File class from expo-file-system as intended in this architecture
    if (!agentFile.exists) {
      agentFile.create();
    }

    agentFile.write(markdown);

    return agentFile.uri;
  }

  /**
   * Helper to format Agent-specific Markdown.
   * Personas/Writers don't use [SECTION] tags, so we manually
   * assemble the YAML + Body.
   */
  private static generateAgentMarkdown(
    frontmatter: any,
    content: string,
  ): string {
    const yamlLines = Object.entries(frontmatter).map(([k, v]) => {
      const value = typeof v === "string" ? JSON.stringify(v) : v;
      // Handle array formatting for YAML (like writerIds)
      if (Array.isArray(v)) {
        return `${k}:\n${v.map((id) => `  - ${id}`).join("\n")}`;
      }
      return `${k}: ${value}`;
    });

    return `---\n${yamlLines.join("\n")}\n---\n\n${content.trim()}`;
  }
}

// packages/core/src/services/CompilerService.ts
import { Brief } from "../agents/Architect.js";
import { HubState, SectionBlueprint } from "../types/index.js";
import { IoService } from "./IoService.js";
import { LoggerService } from "./LoggerService.js";

export class CompilerService {
  /**
   * Generates the initial JSON state machine for a new Hub based on the Architect's brief
   * and the Outliner's sections.
   */
  static generateInitialState(
    brief: Brief,
    sections: SectionBlueprint[],
    title: string,
    description: string,
  ): HubState {
    return {
      title,
      description,
      hubId: brief.hubId,
      topic: brief.topic,
      goal: brief.goal,
      audience: brief.audience,
      language: brief.language,
      date: new Date().toISOString().split("T")[0],
      assemblerId: brief.assemblerId,
      allowedAssemblerIds: brief.allowedAssemblerIds,
      personaId: brief.personaId,
      allowedWriterIds: brief.allowedWriterIds,
      sections: sections,
    };
  }

  /**
   * Reads the hub.json state, iterates over the outline,
   * reads the atomic blocks from disk, and stitches them into `compiled.md`.
   */
  static async compile(hubRootDir: string): Promise<string> {
    try {
      const stateRaw = await IoService.readFile(
        IoService.join(hubRootDir, "hub.json"),
      );
      const state: HubState = JSON.parse(stateRaw);

      let compiledMarkdown = `# ${state.title}\n\n`;

      for (const section of state.sections) {
        // Render the section header dynamically based on its level
        compiledMarkdown += `${"#".repeat(section.level)} ${section.header}\n\n`;

        for (const block of section.blocks) {
          if (block.status === "completed") {
            // Read the isolated atomic block output
            const blockPath = IoService.join(
              hubRootDir,
              "blocks",
              `${section.id}-${block.id}.md`,
            );
            if (await IoService.exists(blockPath)) {
              const blockContent = await IoService.readFile(blockPath);
              compiledMarkdown += `${blockContent}\n\n`;
            } else {
              LoggerService.warn(`Block file missing: ${blockPath}`);
              compiledMarkdown += `> **MISSING BLOCK:** ${block.id}\n\n`;
            }
          } else {
            // Render the pending intent as a TODO for human visibility
            compiledMarkdown += `> **TODO:** ${block.intent}\n\n*Pending generation...*\n\n`;
          }
        }
      }

      // Write the read-only output file for user preview
      const outputPath = IoService.join(hubRootDir, "compiled.md");
      await IoService.writeFile(outputPath, compiledMarkdown.trim());

      return compiledMarkdown.trim();
    } catch (error: any) {
      LoggerService.error("Compilation failed", { error: error.message });
      throw error;
    }
  }
}

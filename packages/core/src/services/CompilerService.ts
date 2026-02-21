import { Brief } from "../agents/Architect.js";
import { HubBlueprint, HubState } from "../types/index.js";
import { IoService } from "./IoService.js";
import { LoggerService } from "./LoggerService.js";

export class CompilerService {
  /**
   * Generates the initial JSON state machine for a new Hub.
   * This replaces the old markdown generateScaffold method.
   */
  static generateInitialState(
    brief: Brief,
    blueprint: HubBlueprint,
    title: string,
    description: string,
  ): HubState {
    return {
      title,
      description,
      hubId: blueprint.hubId,
      topic: brief.topic,
      goal: brief.goal,
      audience: brief.audience,
      language: brief.language,
      date: new Date().toISOString().split("T")[0],
      assemblerId: brief.assemblerId,
      personaId: brief.personaId,
      allowedWriterIds: brief.allowedWriterIds,
      // For Phase 1, we map each legacy component to a section with a single block.
      // In Phase 2, this will become nested.
      sections: blueprint.components.map((c) => ({
        id: c.id,
        header: c.header,
        level: 2, // Default to H2 for top-level sections
        bridge: c.bridge,
        blocks: [
          {
            id: `${c.id}-b1`,
            intent: c.intent,
            writerId: c.writerId,
            status: "pending" as const,
          },
        ],
        assemblerId: "",
      })),
    };
  }

  /**
   * Reads the hub.json state, iterates over the flat outline,
   * reads the atomic blocks, and compiles the final read-only markdown.
   */
  static async compile(hubRootDir: string): Promise<string> {
    try {
      const stateRaw = await IoService.readFile(
        IoService.join(hubRootDir, "hub.json"),
      );
      const state: HubState = JSON.parse(stateRaw);

      let compiledMarkdown = `# ${state.title}\n\n`;

      for (const section of state.sections) {
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

      // Write the read-only output file
      const outputPath = IoService.join(hubRootDir, "compiled.md");
      await IoService.writeFile(outputPath, compiledMarkdown.trim());

      return compiledMarkdown.trim();
    } catch (error: any) {
      LoggerService.error("Compilation failed", { error: error.message });
      throw error;
    }
  }
}

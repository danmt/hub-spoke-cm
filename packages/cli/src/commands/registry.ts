// src/cli/commands/registry.ts
import { RegistryService, WorkspaceService } from "@hub-spoke/core";
import chalk from "chalk";
import { Command } from "commander";

/**
 * registryCommand
 * Visualizes the Hub & Spoke workspace "Intelligence Layer".
 * It fetches dynamic artifacts (Markdown) and displays their metadata
 * based on their discriminated type (Persona, Writer, or Assembler).
 */
export const registryCommand = new Command("registry")
  .description("List all active AI artifacts (Personas, Writers, Assemblers)")
  .action(async () => {
    try {
      // 1. Fetch all artifacts from the workspace once
      const workspaceRoot = await WorkspaceService.findRoot(process.cwd());
      const artifacts = await RegistryService.getAllArtifacts(workspaceRoot);

      if (artifacts.length === 0) {
        console.log(chalk.yellow("\n⚠️  No artifacts found."));
        console.log(
          chalk.gray(
            "Run 'hub init' to seed starter agents or add .md files to /agents.\n",
          ),
        );
        return;
      }

      console.log(chalk.bold.blue("\n🧠 Active Agent Registry"));
      console.log(chalk.gray("-------------------------------------------"));

      // 2. Group and Display by Discriminator Type
      const categories = [
        { label: "👤 PERSONAS", type: "persona" },
        { label: "🏗️  ASSEMBLERS", type: "assembler" },
        { label: "🖋️  WRITERS", type: "writer" },
      ] as const;

      for (const cat of categories) {
        const filtered = artifacts.filter((a) => a.type === cat.type);

        console.log(chalk.cyan(`\n${cat.label}`));

        if (filtered.length === 0) {
          console.log(chalk.dim("   (None active)"));
          continue;
        }

        filtered.forEach((art) => {
          // Display primary ID and description
          console.log(
            `   - ${chalk.bold(art.displayName)}: ${art.description || chalk.dim("No description")}`,
          );

          // 3. Use Discriminated Union for Type-Specific Metadata
          // TypeScript narrows 'art' here based on the check above
          if (art.type === "persona") {
            console.log(
              chalk.dim(
                `     Tone: ${chalk.italic(art.metadata.tone)} | Language: ${art.metadata.language} | Accent: ${art.metadata.accent}`,
              ),
            );
          }
        });
      }

      console.log(chalk.gray("\n-------------------------------------------"));
      console.log(chalk.dim(`Total Artifacts: ${artifacts.length}\n`));
    } catch (error) {
      console.error(
        chalk.red("\n❌ Command `registry` Error:"),
        error instanceof Error ? error.message : String(error),
      );
    }
  });

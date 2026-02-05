// src/cli/commands/fill.ts
import chalk from "chalk";
import { Command } from "commander";
import path from "path";
import { FillService } from "../../core/services/FillService.js";
import { IoService } from "../../core/services/IoService.js";

/**
 * fillCommand
 * Entry point for manual content generation.
 * Locates the target file and triggers the FillService.
 */
export const fillCommand = new Command("fill")
  .description("Generate content for sections marked with TODO blockquotes")
  .option(
    "-f, --file <path>",
    "Specific markdown file to fill (defaults to hub.md)",
  )
  .action(async (options) => {
    try {
      const currentDir = process.cwd();
      let targetFile: string;

      if (options.file) {
        // If a specific file is provided, resolve its absolute path
        targetFile = path.resolve(currentDir, options.file);
      } else {
        // Otherwise, find the Hub root and target the main hub.md
        const rootDir = await IoService.findHubRoot(currentDir);
        targetFile = path.join(rootDir, "hub.md");
      }

      console.log(
        chalk.bold(`\n🔍 Target: ${chalk.cyan(path.basename(targetFile))}`),
      );

      // Execute the service. autoAccept is false here to allow
      // the user to pick sections via checkboxes.
      await FillService.execute(targetFile, false);

      console.log(chalk.bold.green(`\n✨ Generation complete.`));
    } catch (error) {
      console.error(
        chalk.red("\n❌ Fill Error:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

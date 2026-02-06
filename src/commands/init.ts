import chalk from "chalk";
import { Command } from "commander";
import { IoService } from "../services/IoService.js";

export const initCommand = new Command("init")
  .description("Initialize a new Hub & Spoke workspace")
  .option("-b, --blank", "Initialize an empty workspace without starter agents")
  .action(async (options) => {
    try {
      const rootDir = process.cwd();
      const type = options.blank ? "blank" : "starter";

      console.log(
        chalk.blue(
          `\n🏗️  Initializing Hub Workspace in: ${chalk.bold(rootDir)}`,
        ),
      );

      await IoService.initWorkspace(rootDir, type);

      console.log(chalk.green("✅ Workspace structure created."));
      console.log(
        chalk.gray(
          `   - /posts (Your content hubs)\n   - /agents (Your personas, auditors, writers, and assemblers)\n   - /.hub (Workspace configuration)`,
        ),
      );

      if (type === "starter") {
        console.log(
          chalk.cyan(
            "\n🚀 Starter agents (Standard Persona, Tutorial Assembler, Prose Writer, Standard Auditor) deployed to /agents.",
          ),
        );
      }
    } catch (error) {
      console.error(
        chalk.red("\n❌ Init Error:"),
        error instanceof Error ? error.message : String(error),
      );
    }
  });

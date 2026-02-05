#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import dotenv from "dotenv";

// Import Commands
// Explicit .js extension is required for NodeNext module resolution
import { checkCommand } from "./commands/check.js";
import { configCommand } from "./commands/config.js";
import { fillCommand } from "./commands/fill.js";
import { initCommand } from "./commands/init.js";
import { mapCommand } from "./commands/map.js";
import { newCommand } from "./commands/new.js";
import { registryCommand } from "./commands/registry.js";
import { spawnCommand } from "./commands/spawn.js";

// Load environment variables
dotenv.config();

const program = new Command();

async function main() {
  program
    .name("hub")
    .description(
      'Hub & Spoke Content Manager - A "Vibe Coding" CLI for scaling technical content',
    )
    .version("1.0.0");

  // Register Commands
  program.addCommand(initCommand);
  program.addCommand(registryCommand);
  program.addCommand(newCommand);
  program.addCommand(checkCommand);
  program.addCommand(fillCommand);
  program.addCommand(spawnCommand);
  program.addCommand(mapCommand);
  program.addCommand(configCommand);

  // Global Error Handling
  program.on("command:*", () => {
    console.error(
      chalk.red(
        "Invalid command: %s\nSee --help for a list of available commands.",
      ),
      program.args.join(" "),
    );
    process.exit(1);
  });

  // Show help if no arguments provided
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(chalk.red("Fatal Error:"), err);
  process.exit(1);
});

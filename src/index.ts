#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import dotenv from "dotenv";

// Import Commands
// Explicit .js extension is required for NodeNext module resolution
import { checkCommand } from "./commands/check.js";
import { configCommand } from "./commands/config.js";
import { exportCommand } from "./commands/export.js";
import { fillCommand } from "./commands/fill.js";
import { initCommand } from "./commands/init.js";
import { newCommand } from "./commands/new.js";
import { registryCommand } from "./commands/registry.js";
import { LoggerService } from "./services/LoggerService.js";
import { getGlobalConfig } from "./utils/config.js";

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

  console.log(getGlobalConfig());
  // Register Commands
  program.addCommand(initCommand);
  program.addCommand(registryCommand);
  program.addCommand(newCommand);
  program.addCommand(checkCommand);
  program.addCommand(fillCommand);
  program.addCommand(configCommand);
  program.addCommand(exportCommand);

  // Global Error Handling
  program.on("command:*", async () => {
    const msg = `Invalid command: ${program.args.join(" ")}\nSee --help for a list of available commands.`;
    await LoggerService.warn(msg);
    console.error(chalk.red(msg));
    process.exit(1);
  });

  // Show help if no arguments provided
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }

  await program.parseAsync(process.argv);
}

main().catch(async (err) => {
  await LoggerService.error("Fatal Application Error", {
    message: err.message,
    stack: err.stack,
  });

  console.error(chalk.red("\n❌ Fatal Error:"), err.message);
  process.exit(1);
});

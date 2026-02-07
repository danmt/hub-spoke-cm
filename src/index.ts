#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import dotenv from "dotenv";

// Import Commands
// Explicit .js extension is required for NodeNext module resolution
import { auditCommand } from "./commands/audit.js";
import { checkCommand } from "./commands/check.js";
import { configCommand } from "./commands/config.js";
import { fillCommand } from "./commands/fill.js";
import { initCommand } from "./commands/init.js";
import { mapCommand } from "./commands/map.js";
import { newCommand } from "./commands/new.js";
import { registryCommand } from "./commands/registry.js";
import { spawnCommand } from "./commands/spawn.js";
import { LoggerService } from "./services/LoggerService.js";

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
  program.addCommand(auditCommand);

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

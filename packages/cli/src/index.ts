#!/usr/bin/env node
import {
  ConfigService,
  IoService,
  LoggerService,
  SecretService,
  WorkspaceService,
} from "@hub-spoke/core";
import chalk from "chalk";
import { Command } from "commander";
import dotenv from "dotenv";
import { agentCommand } from "./commands/agent.js";
import { configCommand } from "./commands/config.js";
import { exportCommand } from "./commands/export.js";
import { fillCommand } from "./commands/fill.js";
import { initCommand } from "./commands/init.js";
import { newCommand } from "./commands/new.js";
import { registryCommand } from "./commands/registry.js";
import { NodeConfigProvider } from "./providers/NodeConfigProvider.js";
import { NodeIoProvider } from "./providers/NodeIoProvider.js";
import { NodeLoggerProvider } from "./providers/NodeLoggerProvider.js";
import { NodeSecretProvider } from "./providers/NodeSecretProvider.js";

// Load environment variables
dotenv.config();

const program = new Command();

async function main() {
  const currentDir = process.cwd();

  IoService.setProvider(new NodeIoProvider());
  SecretService.setProvider(new NodeSecretProvider());
  ConfigService.setProvider(new NodeConfigProvider());
  LoggerService.setProvider(new NodeLoggerProvider());

  const workspaceRoot = await WorkspaceService.findRoot(currentDir);

  await LoggerService.info("CLI initialized in workspace", { workspaceRoot });

  program
    .name("hub")
    .description(
      'Hub & Spoke Content Manager - A "Vibe Coding" CLI for scaling technical content',
    )
    .version("0.1.0-alpha.1")
    .showHelpAfterError();

  // Register Commands
  program.addCommand(initCommand);
  program.addCommand(registryCommand);
  program.addCommand(newCommand);
  program.addCommand(fillCommand);
  program.addCommand(configCommand);
  program.addCommand(exportCommand);
  program.addCommand(agentCommand);

  // Global Error Handling
  program.on("command:*", async () => {
    const msg = `Invalid command: ${program.args.join(" ")}\nSee --help for a list of available commands.`;
    await LoggerService.warn(msg);
    console.error(chalk.red(msg));
    process.exit(1);
  });

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

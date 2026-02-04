#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const program = new Command();

async function main() {
  program
    .name("hub")
    .description(
      "Hub & Spoke Content Manager - CLI for scaling technical content",
    )
    .version("1.0.0");

  // We will register commands here in Phase 4 (Step 10)
  // Example: program.addCommand(newCommand);

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

  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(chalk.red("Fatal Error:"), err);
  process.exit(1);
});

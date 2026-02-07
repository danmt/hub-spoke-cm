// src/commands/fill.ts
import chalk from "chalk";
import { Command } from "commander";
import fs from "fs/promises";
import inquirer from "inquirer";
import path from "path";
import { FillService } from "../services/FillService.js";
import { IoService } from "../services/IoService.js";
import { LoggerService } from "../services/LoggerService.js";
import { ParserService } from "../services/ParserService.js";
import { RegistryService } from "../services/RegistryService.js";

const TODO_REGEX = />\s*\*\*?TODO:?\*?\s*(.*)/i;

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
        targetFile = path.resolve(currentDir, options.file);
      } else {
        const workspaceRoot = await IoService.findWorkspaceRoot(currentDir);
        const hubs = await IoService.findAllHubsInWorkspace(workspaceRoot);

        if (hubs.length === 0) {
          throw new Error("No hubs found in the workspace posts/ directory.");
        }

        const { targetHub } = await inquirer.prompt([
          {
            type: "list",
            name: "targetHub",
            message: "Select a Hub to fill:",
            choices: hubs,
          },
        ]);

        targetFile = path.join(workspaceRoot, "posts", targetHub, "hub.md");
      }

      console.log(
        chalk.bold(`\n🔍 Target: ${chalk.cyan(path.basename(targetFile))}`),
      );

      const content = await fs.readFile(targetFile, "utf-8");
      const parsed = ParserService.parseMarkdown(content);

      const fillableHeaders = Object.entries(parsed.sections)
        .filter(([_, body]) => TODO_REGEX.test(body))
        .map(([header]) => header);

      if (fillableHeaders.length === 0) {
        return console.log(
          chalk.yellow("✨ No sections marked with TODO found."),
        );
      }

      const { selection } = await inquirer.prompt([
        {
          type: "checkbox",
          name: "selection",
          message: "Select sections to generate (Sequential):",
          choices: fillableHeaders.map((h) => ({ name: h, checked: true })),
        },
      ]);

      const rawArtifacts = await RegistryService.getAllArtifacts();
      const agents = RegistryService.initializeAgents(rawArtifacts);
      const persona = RegistryService.getAgentsByType(agents, "persona").find(
        (p) => p.artifact.id === parsed.frontmatter.personaId,
      );
      const writers = RegistryService.getAgentsByType(agents, "writer");

      if (!persona)
        throw new Error(`Persona "${parsed.frontmatter.personaId}" not found.`);

      console.log(
        chalk.blue(`\n🚀 Generating ${selection.length} sections...\n`),
      );

      // Implementation of original retry logic wrapped around the service call
      for (let i = 0; i < selection.length; i++) {
        const header = selection[i];
        try {
          await FillService.execute(
            targetFile,
            [header],
            persona,
            writers,
            (p) => {
              if (p.status === "starting") {
                process.stdout.write(
                  chalk.gray(`   Generating [${p.writerId}] "${p.header}"... `),
                );
              } else if (p.status === "completed") {
                process.stdout.write(chalk.green("Done ✅\n"));
              }
            },
          );
        } catch (err: any) {
          process.stdout.write(chalk.red("Failed ❌\n"));
          const { retry } = await inquirer.prompt([
            {
              type: "confirm",
              name: "retry",
              message: `Retry section "${header}"?`,
            },
          ]);
          if (retry) {
            i--; // Decrement index to repeat the same header
            continue;
          }
          break; // Stop sequential generation on failure if not retried
        }
      }

      console.log(chalk.bold.green(`\n✨ Generation complete.`));
    } catch (error: any) {
      await LoggerService.error("Fill Command Failed", {
        error: error.message,
        stack: error.stack,
      });
      console.error(chalk.red("\n❌ Fill Error:"), error.message);
      process.exit(1);
    }
  });

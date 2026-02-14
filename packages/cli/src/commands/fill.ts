// src/commands/fill.ts
import {
  IoService,
  LoggerService,
  ParserService,
  RegistryService,
} from "@hub-spoke/core";
import chalk from "chalk";
import { Command } from "commander";
import fs from "fs/promises";
import inquirer from "inquirer";
import path from "path";
import { executeCliFillAction } from "../presets/executeCliFillAction.js";
import { ConfigStorage } from "../services/ConfigStorage.js";

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
      let workspaceRoot: string;

      try {
        workspaceRoot = await IoService.findWorkspaceRoot(currentDir);
      } catch (err) {
        console.error(
          chalk.red(
            "\n❌ Error: Not in a Hub workspace. Run 'hub init' first.",
          ),
        );
        process.exit(1);
      }

      if (options.file) {
        targetFile = path.resolve(currentDir, options.file);
      } else {
        const workspaceRoot = await IoService.findWorkspaceRoot(currentDir);
        const { rootDir } = await IoService.resolveHubContext(
          workspaceRoot,
          currentDir,
          async (hubs) => {
            const { targetHub } = await inquirer.prompt([
              {
                type: "list",
                name: "targetHub",
                message: "Select Hub:",
                choices: hubs,
              },
            ]);
            return targetHub;
          },
        );
        const hubMeta = await IoService.readHubMetadata(rootDir);
        targetFile = path.join(workspaceRoot, "posts", hubMeta.hubId, "hub.md");
      }

      console.log(
        chalk.bold(`\n🔍 Target: ${chalk.cyan(path.basename(targetFile))}`),
      );

      const content = await fs.readFile(targetFile, "utf-8");
      const parsed = ParserService.parseMarkdown(content);

      const rawArtifacts = await RegistryService.getAllArtifacts(workspaceRoot);

      const config = await ConfigStorage.load();

      if (!config.apiKey) {
        console.error(
          chalk.red(
            "Error: API Key not found. Run 'hub config set-key' first.",
          ),
        );
        process.exit(1);
      }

      if (!config.model) {
        console.error(
          chalk.red(
            "Error: Default model not found. Run 'hub config set-model' first.",
          ),
        );
        process.exit(1);
      }

      const agents = RegistryService.initializeAgents(
        config.apiKey,
        config.model,
        rawArtifacts,
      );

      await executeCliFillAction(
        agents,
        parsed.frontmatter.personaId,
        targetFile,
        content,
      );
    } catch (error: any) {
      await LoggerService.error("Fill Command Failed", {
        error: error.message,
        stack: error.stack,
      });
      console.error(chalk.red("\n❌ Command `fill` Error:"), error.message);
      process.exit(1);
    }
  });

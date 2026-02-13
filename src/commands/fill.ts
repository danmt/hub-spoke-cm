// src/commands/fill.ts
import chalk from "chalk";
import { Command } from "commander";
import fs from "fs/promises";
import inquirer from "inquirer";
import path from "path";
import { executeCliFillAction } from "../presets/executeCliFillAction.js";
import { IoService } from "../services/IoService.js";
import { LoggerService } from "../services/LoggerService.js";
import { ParserService } from "../services/ParserService.js";
import {
  getAgentsByType,
  RegistryService,
} from "../services/RegistryService.js";

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
        const { rootDir } = await IoService.resolveHubContext(
          workspaceRoot,
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

      const fillableSectionIds = Object.entries(parsed.sections)
        .filter(([_, body]) => TODO_REGEX.test(body))
        .map(([header]) => header);

      if (fillableSectionIds.length === 0) {
        return console.log(
          chalk.yellow("✨ No sections marked with TODO found."),
        );
      }

      const { sectionIdsToFill } = await inquirer.prompt([
        {
          type: "checkbox",
          name: "selection",
          message: "Select sections to generate (Sequential):",
          choices: fillableSectionIds.map((sectionId) => ({
            name: sectionId,
            checked: true,
          })),
        },
      ]);

      const rawArtifacts = await RegistryService.getAllArtifacts();
      const agents = RegistryService.initializeAgents(rawArtifacts);
      const persona = getAgentsByType(agents, "persona").find(
        (p) => p.artifact.id === parsed.frontmatter.personaId,
      );
      const writers = getAgentsByType(agents, "writer");

      if (!persona)
        throw new Error(`Persona "${parsed.frontmatter.personaId}" not found.`);

      await executeCliFillAction(
        persona.agent,
        writers.map((writer) => writer.agent),
        targetFile,
        content,
        sectionIdsToFill,
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

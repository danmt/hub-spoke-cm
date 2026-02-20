// src/commands/new.ts
import {
  ConfigService,
  ParserService,
  RegistryService,
  SecretService,
  WorkspaceService,
} from "@hub-spoke/core";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import { executeCliCreateHubAction } from "../presets/executeCliCreateHubAction.js";
import { executeCliFillAction } from "../presets/executeCliFillAction.js";

export const newCommand = new Command("new")
  .description("Create a new Hub inside the workspace /posts directory")
  .action(async () => {
    try {
      const workspaceRoot = await WorkspaceService.findRoot(process.cwd());
      const rawArtifacts = await RegistryService.getAllArtifacts(workspaceRoot);
      const config = await ConfigService.getConfig();
      const secret = await SecretService.getSecret();

      if (!secret.apiKey) {
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
        secret.apiKey,
        config.model,
        rawArtifacts,
      );

      try {
        RegistryService.validateIntegrity(agents);
      } catch (error) {
        console.error(chalk.red("\n❌ Registry Integrity Check Failed:"));
        console.error(chalk.yellow((error as Error).message));
        process.exit(1);
      }

      const manifest = RegistryService.toManifest(agents);

      console.log(chalk.gray(`\n📂 Active Workspace: ${workspaceRoot}`));

      const { filePath, fileContent } = await executeCliCreateHubAction(
        secret.apiKey,
        config.model,
        manifest,
        agents,
        workspaceRoot,
      );

      const { shouldFill } = await inquirer.prompt([
        {
          type: "confirm",
          name: "shouldFill",
          message: "Generate content now?",
          default: true,
        },
      ]);

      if (!shouldFill) {
        return;
      }

      const { frontmatter, sections } =
        ParserService.parseMarkdown(fileContent);

      await executeCliFillAction(
        workspaceRoot,
        agents,
        frontmatter,
        sections,
        filePath,
      );
    } catch (error) {
      console.error(chalk.red("\n❌ Command `new` Error:"), error);
    }
  });

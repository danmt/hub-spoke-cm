// src/commands/new.ts
import { IoService, RegistryService } from "@hub-spoke/core";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import { executeCliCreateHubAction } from "../presets/executeCliCreateHubAction.js";
import { executeCliFillAction } from "../presets/executeCliFillAction.js";
import { NodeConfigStorage } from "../services/NodeConfigStorage.js";

export const newCommand = new Command("new")
  .description("Create a new Hub inside the workspace /posts directory")
  .action(async () => {
    try {
      const workspaceRoot = await IoService.findWorkspaceRoot(process.cwd());
      const rawArtifacts = await RegistryService.getAllArtifacts(workspaceRoot);

      const config = await NodeConfigStorage.load();

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

      try {
        RegistryService.validateIntegrity(agents);
      } catch (error) {
        console.error(chalk.red("\n❌ Registry Integrity Check Failed:"));
        console.error(chalk.yellow((error as Error).message));
        process.exit(1);
      }

      const manifest = RegistryService.toManifest(agents);

      console.log(chalk.gray(`\n📂 Active Workspace: ${workspaceRoot}`));

      const { architecture, filePath, fileContent } =
        await executeCliCreateHubAction(
          config.apiKey,
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

      await executeCliFillAction(
        agents,
        architecture.brief.personaId,
        filePath,
        fileContent,
      );
    } catch (error) {
      console.error(chalk.red("\n❌ Command `new` Error:"), error);
    }
  });

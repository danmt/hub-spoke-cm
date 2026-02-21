// src/commands/fill.ts
import {
  ConfigService,
  HubService,
  LoggerService,
  RegistryService,
  SecretService,
  WorkspaceService,
} from "@hub-spoke/core";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import { executeCliFillAction } from "../presets/executeCliFillAction.js";

export const fillCommand = new Command("fill")
  .description(
    "Generate content for sections and blocks marked as pending in the hub.json state",
  )
  .action(async () => {
    try {
      const currentDir = process.cwd();
      const workspaceRoot = await WorkspaceService.findRoot(currentDir);

      // 1. Resolve which hub the user wants to fill
      const { rootDir, hubId } = await HubService.resolveHubContext(
        workspaceRoot,
        currentDir,
        async (hubs) => {
          const { targetHub } = await inquirer.prompt([
            {
              type: "list",
              name: "targetHub",
              message: "Select Hub to fill:",
              choices: hubs,
            },
          ]);
          return targetHub;
        },
      );

      console.log(chalk.bold(`\n🔍 Target Hub: ${chalk.cyan(hubId)}`));

      // 2. Load environment configuration and secrets
      const config = await ConfigService.getConfig();
      const secret = await SecretService.getSecret();

      if (!secret.apiKey) {
        throw new Error("API Key not found. Run 'hub config set-key' first.");
      }

      if (!config.model) {
        console.error(
          chalk.red(
            "Error: Default model not found. Run 'hub config set-model' first.",
          ),
        );
        process.exit(1);
      }

      // 3. Initialize credentialed agents from the workspace registry
      const rawArtifacts = await RegistryService.getAllArtifacts(workspaceRoot);
      const agents = RegistryService.initializeAgents(
        secret.apiKey,
        config.model,
        rawArtifacts,
      );

      // 4. Trigger the refactored fill logic using the hub's root directory
      // This will now process optimized headers and pending blocks
      await executeCliFillAction(workspaceRoot, agents, rootDir);

      console.log(chalk.bold.green(`\n✨ Fill process for ${hubId} complete.`));
    } catch (error: any) {
      await LoggerService.error("Fill Command Failed", {
        error: error.message,
        stack: error.stack,
      });
      console.error(chalk.red("\n❌ Command `fill` Error:"), error.message);
      process.exit(1);
    }
  });

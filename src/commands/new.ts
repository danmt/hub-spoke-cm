// src/commands/new.ts
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import { executeCliCreateHubAction } from "../presets/executeCliCreateHubAction.js";
import { executeCliFillAction } from "../presets/executeCliFillAction.js";
import { IoService } from "../services/IoService.js";
import { RegistryService } from "../services/RegistryService.js";

export const newCommand = new Command("new")
  .description("Create a new Hub inside the workspace /posts directory")
  .action(async () => {
    try {
      const workspaceRoot = await IoService.findWorkspaceRoot(process.cwd());
      const rawArtifacts = await RegistryService.getAllArtifacts();
      const agents = RegistryService.initializeAgents(rawArtifacts);

      try {
        RegistryService.validateIntegrity(agents);
      } catch (error) {
        console.error(chalk.red("\n❌ Registry Integrity Check Failed:"));
        console.error(chalk.yellow((error as Error).message));
        process.exit(1);
      }

      const manifest = RegistryService.toManifest(agents);

      console.log(chalk.gray(`\n📂 Active Workspace: ${workspaceRoot}`));

      const { architecture, assembly, filePath, fileContent } =
        await executeCliCreateHubAction(manifest, agents);

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
        assembly.blueprint.components.map((c) => c.id),
      );
    } catch (error) {
      console.error(chalk.red("\n❌ Command `new` Error:"), error);
    }
  });

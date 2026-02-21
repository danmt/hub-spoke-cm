// packages/cli/src/commands/export.ts
import { HubService, IoService, WorkspaceService } from "@hub-spoke/core";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";

export const exportCommand = new Command("export")
  .description(
    "Export the finalized Hub (compiled.md) to the top-level /output folder",
  )
  .action(async () => {
    try {
      const currentDir = process.cwd();
      const workspaceRoot = await WorkspaceService.findRoot(currentDir);

      // 1. Resolve which Hub to export
      const { rootDir, hubId } = await HubService.resolveHubContext(
        workspaceRoot,
        currentDir,
        async (hubs) => {
          const { targetHub } = await inquirer.prompt([
            {
              type: "list",
              name: "targetHub",
              message: "Select Hub to export:",
              choices: hubs,
            },
          ]);
          return targetHub;
        },
      );

      // 2. Identify the source (compiled.md) and target path
      // The CompilerService ensures this file is always up-to-date
      const sourcePath = IoService.join(rootDir, "compiled.md");
      const outputPath = IoService.join(workspaceRoot, "output", `${hubId}.md`);

      // 3. Validation: Ensure the hub has actually been compiled
      if (!(await IoService.exists(sourcePath))) {
        throw new Error(
          `No compiled output found for "${hubId}". Run 'hub fill' first.`,
        );
      }

      // 4. Handle Overwrite Confirmation
      if (await IoService.exists(outputPath)) {
        const { confirmOverwrite } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmOverwrite",
            message: chalk.yellow(
              `"${hubId}.md" already exists in /output. Overwrite?`,
            ),
            default: false,
          },
        ]);

        if (!confirmOverwrite) {
          console.log(chalk.gray("Export cancelled."));
          return;
        }
      }

      // 5. Atomic Export: Move the compiled truth to the output folder
      const finalContent = await IoService.readFile(sourcePath);
      await IoService.writeFile(outputPath, finalContent);

      console.log(
        chalk.green(
          `\n✅ Final document exported to: ${chalk.bold(`output/${hubId}.md`)}`,
        ),
      );
    } catch (error: any) {
      console.error(chalk.red("\n❌ Export Failed:"), error.message);
      process.exit(1);
    }
  });

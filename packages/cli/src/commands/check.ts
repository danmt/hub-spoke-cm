import { IoService, ValidationService } from "@hub-spoke/core";
import chalk from "chalk";
import { Command } from "commander";
import path from "path";

export const checkCommand = new Command("check")
  .description("Validate project consistency and check for pending TODOs")
  .action(async () => {
    try {
      const workspaceRoot = await IoService.findWorkspaceRoot(process.cwd());
      const hubs = await IoService.findAllHubsInWorkspace(workspaceRoot);

      for (const hubId of hubs) {
        const rootDir = path.join(workspaceRoot, "posts", hubId);
        const hubMeta = await IoService.readHubMetadata(rootDir);

        console.log(
          chalk.bold(`\n🔍 Checking Hub: ${chalk.cyan(hubMeta.title)}`),
        );

        const filePath = path.join(rootDir, "hub.md");
        const report = await ValidationService.checkIntegrity(
          filePath,
          hubMeta.personaId,
          hubMeta.language,
        );

        if (report.isValid) {
          console.log(chalk.green(`   ✅ "hub.md": Valid`));
        } else {
          console.log(chalk.red(`   ❌ "hub.md": Issues found`));
          report.issues.forEach((issue) =>
            console.log(chalk.gray(`      - ${issue}`)),
          );
        }
      }
    } catch (error) {
      console.error(chalk.red("\n❌ Command `check` Error:"), error);
    }
  });

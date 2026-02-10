import chalk from "chalk";
import { Command } from "commander";
import path from "path";
import { IoService } from "../services/IoService.js";
import { ValidationService } from "../services/ValidationService.js";

export const checkCommand = new Command("check")
  .description("Validate project consistency and check for pending TODOs")
  .action(async () => {
    try {
      const workspaceRoot = await IoService.findWorkspaceRoot(process.cwd());
      const hubs = await IoService.findAllHubsInWorkspace(workspaceRoot);

      for (const hubId of hubs) {
        const rootDir = path.join(workspaceRoot, "posts", hubId);
        const hubMeta = await IoService.readHubMetadata(rootDir);
        const files = await IoService.getSpokeFiles(rootDir);
        const allFiles = [
          "hub.md",
          ...files.map((f) => path.join("spokes", f)),
        ];

        console.log(
          chalk.bold(`\n🔍 Checking Hub: ${chalk.cyan(hubMeta.title)}`),
        );

        for (const file of allFiles) {
          const filePath = path.join(rootDir, file);
          const report = await ValidationService.checkIntegrity(
            filePath,
            hubMeta.personaId,
            hubMeta.language,
          );

          if (report.isValid) {
            console.log(chalk.green(`   ✅ ${file}: Valid`));
          } else {
            console.log(chalk.red(`   ❌ ${file}: Issues found`));
            report.issues.forEach((issue) =>
              console.log(chalk.gray(`      - ${issue}`)),
            );
          }
        }
      }
    } catch (error) {
      console.error(chalk.red("\n❌ Command `check` Error:"), error);
    }
  });

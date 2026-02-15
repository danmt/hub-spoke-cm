// src/commands/export.ts
import { IoService, ParserService } from "@hub-spoke/core";
import chalk from "chalk";
import { Command } from "commander";
import { existsSync } from "fs";
import fs from "fs/promises";
import inquirer from "inquirer";
import path from "path";

export const exportCommand = new Command("export")
  .description(
    "Export a Hub as a clean Markdown file to the top-level /output folder",
  )
  .option("-f, --file <path>", "Specific markdown file to export")
  .action(async (options) => {
    try {
      const currentDir = process.cwd();
      const workspaceRoot = await IoService.findWorkspaceRoot(currentDir);

      let sourceFile: string;
      let hubRootDir: string;

      if (options.file) {
        sourceFile = path.resolve(currentDir, options.file);
        hubRootDir = path.dirname(sourceFile);
      } else {
        const context = await IoService.resolveHubContext(
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
        hubRootDir = context.rootDir;
        sourceFile = path.join(hubRootDir, "hub.md");
      }

      // 2. Parse metadata and strip internal delimiters
      const rawContent = await fs.readFile(sourceFile, "utf-8");
      const { frontmatter, content: cleanMarkdown } =
        ParserService.stripInternalMetadata(rawContent);

      // 3. Resolve top-level /output path
      const globalOutputDir = path.join(workspaceRoot, "output");
      const outputPath = path.join(globalOutputDir, `${frontmatter.hubId}.md`);

      // 4. Handle Overwrite Confirmation
      if (existsSync(outputPath)) {
        const { confirmOverwrite } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmOverwrite",
            message: chalk.yellow(
              `File "${outputPath}" already exists in /output. Overwrite?`,
            ),
            default: false,
          },
        ]);

        if (!confirmOverwrite) {
          console.log(chalk.gray("Export cancelled."));
          return;
        }
      }

      await IoService.safeWriteFile(outputPath, cleanMarkdown);

      console.log(
        chalk.green(
          `\n✅ Clean Markdown exported to: ${chalk.bold(path.relative(workspaceRoot, outputPath))}`,
        ),
      );
    } catch (error: any) {
      console.error(chalk.red("\n❌ Export Failed:"), error.message);
      process.exit(1);
    }
  });

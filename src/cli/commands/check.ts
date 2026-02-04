import chalk from "chalk";
import { Command } from "commander";
import { findHubRoot, readAnatomy, readHubFile } from "../../core/io.js";
import { parseMarkdown } from "../../core/parser.js";

export const checkCommand = new Command("check")
  .description("Verify consistency between anatomy.json and hub.md")
  .action(async () => {
    try {
      // 1. Establish Context (SRS 2.1)
      // Locate the hub root from the current directory
      const rootDir = await findHubRoot(process.cwd());

      // 2. Load Data
      const anatomy = await readAnatomy(rootDir);
      const rawHubContent = await readHubFile(rootDir);
      const parsedHub = parseMarkdown(rawHubContent);

      console.log(chalk.blue(`\n🔍 Checking Hub: ${anatomy.hubId}`));
      console.log(chalk.gray(`   Goal: ${anatomy.goal}\n`));

      // 3. Reconcile (SRS 4.2)
      // We compare the headers defined in Anatomy vs. headers found in Markdown

      const anatomyHeaders = new Set(anatomy.components.map((c) => c.header));
      const markdownHeaders = new Set(Object.keys(parsedHub.sections));

      let allSynced = true;

      // A. Check for Missing Sections (Defined in Anatomy, missing in MD)
      anatomy.components.forEach((comp) => {
        if (markdownHeaders.has(comp.header)) {
          console.log(chalk.green(`  ✅ ${comp.header}`));
        } else {
          console.log(chalk.red(`  ❌ ${comp.header} (Missing in hub.md)`));
          allSynced = false;
        }
      });

      // B. Check for Unmapped Sections (Found in MD, not in Anatomy)
      markdownHeaders.forEach((header) => {
        if (!anatomyHeaders.has(header)) {
          console.log(
            chalk.yellow(`  ⚠️  ${header} (Found in MD but not in Anatomy)`),
          );
          allSynced = false;
        }
      });

      console.log("\n---");
      if (allSynced) {
        console.log(chalk.green("✨ Hub is perfectly synced!"));
      } else {
        console.log(
          chalk.white("Run ") +
            chalk.yellow("hub map") +
            chalk.white(" to see spoke connections (Coming soon)."),
        );
        console.log(
          chalk.white("Edit ") +
            chalk.bold("anatomy.json") +
            chalk.white(" or ") +
            chalk.bold("hub.md") +
            chalk.white(" to resolve mismatches."),
        );
      }
    } catch (error) {
      console.error(
        chalk.red("Check failed:"),
        error instanceof Error ? error.message : String(error),
      );
    }
  });

import chalk from "chalk";
import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import { findHubRoot, readAnatomy } from "../../core/io.js";
import { parseMarkdown } from "../../core/parser.js";

export const mapCommand = new Command("map")
  .description("Visualize the content relationship graph")
  .action(async () => {
    try {
      // 1. Setup Context
      const rootDir = await findHubRoot(process.cwd());
      const anatomy = await readAnatomy(rootDir);

      console.log(chalk.blue(`\n🗺️  Content Map: ${anatomy.goal}`));
      console.log(chalk.gray(`   Hub ID: ${anatomy.hubId}\n`));

      // 2. Scan Spokes
      const spokesDir = path.join(rootDir, "spokes");
      let spokeFiles: string[] = [];

      try {
        const files = await fs.readdir(spokesDir);
        spokeFiles = files.filter((f) => f.endsWith(".md"));
      } catch {
        // Directory might not exist yet
        spokeFiles = [];
      }

      // 3. Categorize Spokes
      const spokesMap: Record<string, string[]> = {}; // componentId -> [filenames]
      const globalSpokes: string[] = [];
      const orphans: string[] = [];

      // Initialize map with anatomy components
      anatomy.components.forEach((c) => {
        spokesMap[c.id] = [];
      });

      for (const file of spokeFiles) {
        const content = await fs.readFile(path.join(spokesDir, file), "utf-8");
        const { frontmatter } = parseMarkdown(content);

        // Validation: Is it part of this hub?
        if (frontmatter.hubId !== anatomy.hubId) {
          orphans.push(`${file} (Wrong HubID: ${frontmatter.hubId})`);
          continue;
        }

        if (frontmatter.componentId) {
          if (spokesMap[frontmatter.componentId]) {
            spokesMap[frontmatter.componentId].push(file);
          } else {
            orphans.push(
              `${file} (Unknown Component: ${frontmatter.componentId})`,
            );
          }
        } else {
          // No component ID = Global Spoke
          globalSpokes.push(file);
        }
      }

      // 4. Render Tree

      // A. The Hub Root
      console.log(chalk.bold.white("📂 Hub Root"));

      // B. Components & their Spokes
      anatomy.components.forEach((comp, index) => {
        const isLast =
          index === anatomy.components.length - 1 &&
          globalSpokes.length === 0 &&
          orphans.length === 0;
        const prefix = isLast ? "└── " : "├── ";

        console.log(
          `${prefix}${chalk.cyan(comp.header)} ${chalk.gray(`(${comp.id})`)}`,
        );

        const attachedSpokes = spokesMap[comp.id];
        attachedSpokes.forEach((spoke, sIndex) => {
          const spokePrefix = isLast ? "    " : "│   ";
          const isLastSpoke = sIndex === attachedSpokes.length - 1;
          const treeChar = isLastSpoke ? "└── " : "├── ";
          console.log(`${spokePrefix}${treeChar}📄 ${spoke}`);
        });
      });

      // C. Global Spokes
      if (globalSpokes.length > 0) {
        console.log("├── " + chalk.yellow("🌍 Global Context"));
        globalSpokes.forEach((spoke, index) => {
          const isLast =
            index === globalSpokes.length - 1 && orphans.length === 0;
          const treeChar = isLast ? "└── " : "├── ";
          console.log(`│   ${treeChar}📄 ${spoke}`);
        });
      }

      // D. Orphans (Warnings)
      if (orphans.length > 0) {
        console.log("└── " + chalk.red("⚠️  Orphans / Errors"));
        orphans.forEach((spoke, index) => {
          const isLast = index === orphans.length - 1;
          const treeChar = isLast ? "└── " : "├── ";
          console.log(`    ${treeChar}${chalk.red(spoke)}`);
        });
      }

      console.log(""); // Newline at end
    } catch (error) {
      console.error(
        chalk.red("Map failed:"),
        error instanceof Error ? error.message : String(error),
      );
    }
  });

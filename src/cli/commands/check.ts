import chalk from "chalk";
import { Command } from "commander";
import { findHubRoot, readHubFile, readHubMetadata } from "../../core/io.js";
import { parseMarkdown } from "../../core/parser.js";

export const checkCommand = new Command("check")
  .description("Check hub progress (Done vs Pending)")
  .action(async () => {
    try {
      // 1. Establish Context
      const rootDir = await findHubRoot(process.cwd());

      // 2. Load Data (From Markdown Frontmatter)
      const metadata = await readHubMetadata(rootDir);
      const rawContent = await readHubFile(rootDir);
      const parsed = parseMarkdown(rawContent);

      console.log(chalk.blue(`\n🔍 Checking Hub: ${metadata.title}`));
      if (metadata.goal) console.log(chalk.gray(`   Goal: ${metadata.goal}`));
      console.log(chalk.gray(`   Lang: ${metadata.language}\n`));

      // 3. Scan Status
      // We look for Blockquotes: "> **TODO:** ..." or "> TODO: ..."
      const todoRegex = />\s*\*\*?TODO:?\*?/i;

      let pendingCount = 0;
      let doneCount = 0;

      const headers = Object.keys(parsed.sections);

      if (headers.length === 0) {
        console.log(chalk.yellow("   No sections found."));
      }

      headers.forEach((header) => {
        const body = parsed.sections[header];

        if (todoRegex.test(body) || body.includes("*Pending generation...*")) {
          console.log(chalk.yellow(`  ⏳ ${header} (Pending)`));
          pendingCount++;
        } else if (body.trim().length < 50) {
          // Heuristic: If it's very short and no TODO, it might be empty
          console.log(chalk.red(`  ⚠️  ${header} (Empty/Too Short)`));
          pendingCount++;
        } else {
          console.log(chalk.green(`  ✅ ${header}`));
          doneCount++;
        }
      });

      console.log("\n---");
      const total = pendingCount + doneCount;
      const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

      console.log(
        chalk.white(`Progress: ${percent}% Complete (${doneCount}/${total})`),
      );
    } catch (error) {
      console.error(
        chalk.red("Check failed:"),
        error instanceof Error ? error.message : String(error),
      );
    }
  });

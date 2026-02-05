// src/cli/commands/check.ts
import chalk from "chalk";
import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import { findHubRoot, readHubMetadata } from "../../core/io.js";
import { parseMarkdown } from "../../core/parser.js";

export const checkCommand = new Command("check")
  .description("Validate project consistency and check for pending TODOs")
  .action(async () => {
    try {
      const rootDir = await findHubRoot(process.cwd());
      const hubMeta = await readHubMetadata(rootDir);
      const files = await fs.readdir(rootDir);
      const markdownFiles = files.filter((f) => f.endsWith(".md"));

      console.log(
        chalk.bold(`\n🔍 Auditing Hub: ${chalk.cyan(hubMeta.title)}`),
      );
      console.log(chalk.gray(`   Directory: ${rootDir}\n`));

      let totalIssues = 0;

      for (const file of markdownFiles) {
        const filePath = path.join(rootDir, file);
        const content = await fs.readFile(filePath, "utf-8");
        const { frontmatter, sections } = parseMarkdown(content);

        const isHub = frontmatter.type === "hub";
        const label = isHub ? chalk.magenta("[HUB]") : chalk.blue("[SPOKE]");
        console.log(`${label} ${file}`);

        // 1. Validate Persona Consistency
        if (frontmatter.personaId !== hubMeta.personaId) {
          console.log(
            chalk.yellow(
              `   ⚠️  Persona Drift: Found "${frontmatter.personaId}", expected "${hubMeta.personaId}"`,
            ),
          );
          totalIssues++;
        }

        // 2. Validate Language Consistency
        if (frontmatter.language !== hubMeta.language) {
          console.log(
            chalk.yellow(
              `   ⚠️  Language Mismatch: Found "${frontmatter.language}", expected "${hubMeta.language}"`,
            ),
          );
          totalIssues++;
        }

        // 3. Check for empty sections or pending TODOs
        const pendingSections = Object.entries(sections).filter(
          ([_, body]) => body.includes("TODO:") || body.trim().length < 50,
        );

        if (pendingSections.length > 0) {
          pendingSections.forEach(([header]) => {
            console.log(chalk.red(`   ❌ Pending Content: "${header}"`));
          });
          totalIssues += pendingSections.length;
        } else {
          console.log(chalk.green(`   ✅ Fully populated.`));
        }
        console.log("");
      }

      if (totalIssues === 0) {
        console.log(
          chalk.bold.green(
            "✨ Audit passed! Your Hub is consistent and complete.",
          ),
        );
      } else {
        console.log(
          chalk.bold.yellow(`Audit finished with ${totalIssues} issues found.`),
        );
        console.log(
          chalk.gray("Run 'hub fill' to resolve pending content issues."),
        );
      }
    } catch (error) {
      console.error(
        chalk.red("\n❌ Check Error:"),
        error instanceof Error ? error.message : String(error),
      );
    }
  });

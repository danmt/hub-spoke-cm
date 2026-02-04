import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { generateContent } from "../../core/ai.js";
import {
  findHubRoot,
  readAnatomy,
  readHubFile,
  safeWriteFile,
} from "../../core/io.js";
import { parseMarkdown, reconstructMarkdown } from "../../core/parser.js";
// Explicit .js extension for NodeNext compatibility
import { HubComponent } from "../../types/index.js";

export const fillCommand = new Command("fill")
  .description("Generate AI content for hub sections")
  .option("-c, --component <id>", "Specific component ID to fill")
  .option("-a, --all", "Fill all empty sections")
  .action(async (options) => {
    try {
      // 1. Setup Context
      const rootDir = await findHubRoot(process.cwd());
      const anatomy = await readAnatomy(rootDir);
      const rawHubContent = await readHubFile(rootDir);
      const parsedHub = parseMarkdown(rawHubContent);

      // 2. Identify Targets
      let targets: HubComponent[] = [];

      if (options.component) {
        const comp = anatomy.components.find((c) => c.id === options.component);
        if (!comp) {
          console.error(
            chalk.red(
              `Component ID '${options.component}' not found in anatomy.json`,
            ),
          );
          return;
        }
        targets = [comp];
      } else if (options.all) {
        targets = anatomy.components;
      } else {
        // Interactive Selection
        const { selected } = await inquirer.prompt([
          {
            type: "checkbox",
            name: "selected",
            message: "Which sections would you like to fill?",
            choices: anatomy.components.map((c) => ({
              name: `${c.header} (${c.id})`,
              value: c,
            })),
          },
        ]);
        targets = selected;
      }

      if (targets.length === 0) {
        console.log(chalk.yellow("No sections selected."));
        return;
      }

      console.log(
        chalk.blue(
          `\n🤖 Generating content for ${targets.length} section(s)...\n`,
        ),
      );

      // 3. Generate & Inject Content (SRS 4.3.1)
      // We process sequentially to avoid rate limits and overlapping file writes logic
      const updatedSections = { ...parsedHub.sections };

      // We need to know the order of headers to reconstruct the file correctly
      // We use the anatomy order as the master order, but respect existing MD structure if possible
      const anatomyOrder = anatomy.components.map((c) => c.header);

      for (const target of targets) {
        process.stdout.write(
          chalk.white(`   > Writing "${target.header}"... `),
        );

        try {
          // Get surrounding context (previous section) for flow
          // Simple implementation: Just pass the goal. Advanced: Pass prev section text.
          const newContent = await generateContent(
            anatomy.goal,
            target.header,
            target.intent,
          );

          updatedSections[target.header] = newContent;
          process.stdout.write(chalk.green("Done ✅\n"));
        } catch (err) {
          process.stdout.write(chalk.red("Failed ❌\n"));
          console.error(
            chalk.red(
              `     Error: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
        }
      }

      // 4. Save Changes
      // We merge the new sections into the file
      // Note: reconstructMarkdown uses an array of headers to determine order.
      // We should use the union of anatomy headers and existing headers to preserve everything.
      const existingHeaders = Object.keys(parsedHub.sections);
      const uniqueHeaders = Array.from(
        new Set([...anatomyOrder, ...existingHeaders]),
      );

      const newFileContent = [
        "---",
        // We reconstruct frontmatter roughly or just use the raw original if not modifying it
        // Better approach: Use the parsed frontmatter object
        Object.entries(parsedHub.frontmatter)
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join("\n"),
        "---",
        "",
        reconstructMarkdown(updatedSections, uniqueHeaders),
      ].join("\n");

      await safeWriteFile(path.join(rootDir, "hub.md"), newFileContent);

      console.log(chalk.green(`\n✨ Successfully updated hub.md`));
    } catch (error) {
      console.error(
        chalk.red("Fill failed:"),
        error instanceof Error ? error.message : String(error),
      );
    }
  });

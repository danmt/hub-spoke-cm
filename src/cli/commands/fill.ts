import chalk from "chalk";
import { Command } from "commander";
import fs from "fs/promises";
import inquirer from "inquirer";
import path from "path";
import { generateContent } from "../../core/ai.js";
import { findHubRoot, readHubMetadata, safeWriteFile } from "../../core/io.js";
import { parseMarkdown, reconstructMarkdown } from "../../core/parser.js";

// Regex to find Blockquote TODOs (e.g., "> **TODO:** Explain X" or "> TODO: Explain X")
const TODO_REGEX = />\s*\*\*?TODO:?\*?\s*(.*)/i;

export async function runFillLogic(
  filePath: string,
  hubGoal: string,
  language: string,
) {
  const content = await fs.readFile(filePath, "utf-8");
  const parsed = parseMarkdown(content);

  // 1. Identify Sections with Blockquote TODOs
  const fillableSections = Object.entries(parsed.sections).filter(
    ([header, body]) => {
      return TODO_REGEX.test(body);
    },
  );

  if (fillableSections.length === 0) {
    console.log(
      chalk.yellow('No sections with "> **TODO:** ..." found in this file.'),
    );
    return;
  }

  // 2. Interactive Selection
  const { selectedHeaders } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "selectedHeaders",
      message: `Found ${fillableSections.length} pending sections. Which ones to fill?`,
      choices: fillableSections.map(([header]) => ({
        name: header,
        value: header,
        checked: true,
      })),
    },
  ]);

  if (selectedHeaders.length === 0) return;

  console.log(
    chalk.blue(
      `\n🤖 Generating content for ${selectedHeaders.length} section(s) in ${language}...`,
    ),
  );
  console.log(chalk.gray(`   Mode: Sequential (High Quality)\n`));

  const updatedSections = { ...parsed.sections };
  const sectionOrder = Object.keys(parsed.sections);

  // 3. Sequential Loop (1 Request = 1 Section)
  for (const header of selectedHeaders) {
    const currentBody = updatedSections[header];
    const match = currentBody.match(TODO_REGEX);
    // If regex matches, use captured group; otherwise fallback
    const intent = match ? match[1].trim() : "Expand on this topic.";

    process.stdout.write(chalk.white(`   > Writing "${header}"... `));

    try {
      // Calls the Writer model (configured in ai.ts) for a single section
      const newContent = await generateContent(
        hubGoal,
        header,
        intent,
        language,
      );

      updatedSections[header] = newContent;
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

  // 4. Save (Reconstruct file preserving frontmatter)
  const newFileContent = [
    "---",
    Object.entries(parsed.frontmatter)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join("\n"),
    "---",
    "",
    reconstructMarkdown(updatedSections, sectionOrder),
  ].join("\n");

  await safeWriteFile(filePath, newFileContent);
  console.log(chalk.green(`\n✨ Successfully updated file.`));
}

export const fillCommand = new Command("fill")
  .description("Generate AI content for sections with TODO blockquotes")
  .option("-f, --file <path>", "Specific file to fill (defaults to hub.md)")
  .action(async (options) => {
    try {
      // 1. Resolve Context
      const rootDir = await findHubRoot(process.cwd());

      // We need the Hub Metadata to get the Goal and Language
      const metadata = await readHubMetadata(rootDir);
      const hubGoal = metadata.goal || metadata.title;
      const language = metadata.language || "English";

      const targetFile = options.file
        ? path.resolve(process.cwd(), options.file)
        : path.join(rootDir, "hub.md");

      console.log(
        chalk.blue(`Targeting file: ${path.relative(rootDir, targetFile)}`),
      );

      await runFillLogic(targetFile, hubGoal, language);
    } catch (error) {
      console.error(
        chalk.red("Fill failed:"),
        error instanceof Error ? error.message : String(error),
      );
    }
  });

import chalk from "chalk";
import { Command } from "commander";
import fs from "fs/promises";
import inquirer from "inquirer";
import path from "path";
import { generateBatchContent, generateContent } from "../../core/ai.js"; // Import new function
import { findHubRoot, readHubMetadata, safeWriteFile } from "../../core/io.js";
import { parseMarkdown, reconstructMarkdown } from "../../core/parser.js";

const TODO_REGEX = />\s*\*\*?TODO:?\*?\s*(.*)/i;

export async function runFillLogic(
  filePath: string,
  hubGoal: string,
  language: string,
) {
  const content = await fs.readFile(filePath, "utf-8");
  const parsed = parseMarkdown(content);

  // 1. Identify Sections
  const fillableSections = Object.entries(parsed.sections).filter(
    ([header, body]) => {
      return TODO_REGEX.test(body);
    },
  );

  if (fillableSections.length === 0) {
    console.log(chalk.yellow('No sections with "> **TODO:** ..." found.'));
    return;
  }

  // 2. Selection
  const { selectedHeaders } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "selectedHeaders",
      message: `Found ${fillableSections.length} pending sections. Fill which ones?`,
      choices: fillableSections.map(([header]) => ({
        name: header,
        value: header,
        checked: true,
      })),
    },
  ]);

  if (selectedHeaders.length === 0) return;

  const updatedSections = { ...parsed.sections };
  const sectionOrder = Object.keys(parsed.sections);

  // --- NEW: Batching Strategy ---

  if (selectedHeaders.length > 1) {
    console.log(
      chalk.blue(
        `\n⚡ Batching ${selectedHeaders.length} sections into 1 API Request...`,
      ),
    );

    // Prepare the payload
    const batchPayload = selectedHeaders.map((header: string) => {
      const currentBody = updatedSections[header];
      const match = currentBody.match(TODO_REGEX);
      return {
        header,
        intent: match ? match[1].trim() : "Expand on this topic.",
      };
    });

    try {
      process.stdout.write(chalk.white(`   > Generating all... `));

      // ONE Call to Rule Them All
      const batchResults = await generateBatchContent(
        hubGoal,
        batchPayload,
        language,
      );

      // Map results back
      Object.entries(batchResults).forEach(([header, content]) => {
        if (updatedSections[header] !== undefined) {
          updatedSections[header] = content;
        }
      });

      process.stdout.write(chalk.green("Done ✅\n"));
    } catch (err) {
      console.error(
        chalk.red(
          `\n❌ Batch failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
      console.log(
        chalk.yellow(
          "   Tip: Try selecting fewer sections if tokens exceeded.",
        ),
      );
      return; // Don't save partial corruption
    }
  } else {
    // SINGLE MODE (Legacy loop for 1 item)
    // Keep this for granular errors if user only selects 1
    const header = selectedHeaders[0];
    const currentBody = updatedSections[header];
    const match = currentBody.match(TODO_REGEX);
    const intent = match ? match[1].trim() : "Expand on this topic.";

    process.stdout.write(chalk.white(`   > Writing "${header}"... `));
    try {
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
    }
  }

  // 3. Save
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

// ... rest of the file (fillCommand definition) remains the same ...
export const fillCommand = new Command("fill")
  .description("Generate AI content for sections with TODO blockquotes")
  .option("-f, --file <path>", "Specific file to fill (defaults to hub.md)")
  .action(async (options) => {
    try {
      const rootDir = await findHubRoot(process.cwd());
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

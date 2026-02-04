import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { generateAnatomy } from "../../core/ai.js";
import { createHubDirectory, safeWriteFile } from "../../core/io.js";
import { runFillLogic } from "./fill.js";

export const newCommand = new Command("new")
  .description("Create a new Content Hub")
  .argument("<topic>", "The main topic of the hub")
  .action(async (topicArg) => {
    try {
      console.log(chalk.blue(`\n🚀 Initializing new Hub: ${topicArg}\n`));

      // 1. Interactive Refinement
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "goal",
          message: "What is the specific goal/outcome for the reader?",
          default: `Master ${topicArg} from scratch`,
        },
        {
          type: "input",
          name: "audience",
          message: "Who is the target audience?",
          default: "Intermediate Developers",
        },
        {
          type: "list",
          name: "language",
          message: "What language should the content be generated in?",
          choices: ["English", "Spanish", "Portuguese", "French", "German"],
          default: "English",
        },
      ]);

      console.log(
        chalk.yellow(
          "\n🧠 Consulting AI Architect... (This may take a moment)",
        ),
      );

      // 2. AI Generation
      const blueprint = await generateAnatomy(
        topicArg,
        answers.goal,
        answers.audience,
        answers.language,
      );

      console.log(
        chalk.green(`\n✅ Blueprint Created for: ${blueprint.hubId}`),
      );

      // --- NEW: Display the Plan ---
      console.log(chalk.cyan("\nProposed Structure:"));
      blueprint.components.forEach((c) => {
        console.log(`  - ${chalk.bold(c.header)}`);
        console.log(`    ${chalk.gray(c.intent)}`);
      });
      console.log(""); // Empty line
      // -----------------------------

      // 3. Scaffolding
      const hubDir = await createHubDirectory(blueprint.hubId);

      // Construct Hub Markdown with Frontmatter + Blockquote TODOs
      const fileContent = [
        "---",
        `title: "${topicArg}"`,
        'type: "hub"',
        `hubId: "${blueprint.hubId}"`,
        `goal: "${answers.goal}"`,
        `audience: "${answers.audience}"`,
        `language: "${answers.language}"`,
        `date: "${new Date().toISOString().split("T")[0]}"`,
        "---",
        "",
        `# ${topicArg}`,
        "",
        ...blueprint.components.map(
          (c) =>
            `## ${c.header}\n\n> **TODO:** ${c.intent}\n\n*Pending generation...*\n`,
        ),
      ].join("\n");

      await safeWriteFile(path.join(hubDir, "hub.md"), fileContent);

      console.log(
        chalk.green(`\n✅ Hub created successfully at ./${blueprint.hubId}`),
      );

      // 4. Auto-Fill Prompt
      const { doFill } = await inquirer.prompt([
        {
          type: "confirm",
          name: "doFill",
          message: "Do you want to generate the Hub content now?",
          default: false,
        },
      ]);

      if (doFill) {
        await runFillLogic(
          path.join(hubDir, "hub.md"),
          answers.goal,
          answers.language,
        );
      }
    } catch (error) {
      console.error(
        chalk.red("Failed to generate hub:"),
        error instanceof Error ? error.message : String(error),
      );
    }
  });

// src/cli/commands/new.ts
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { ArchitectAgent } from "../../core/agents/Architect.js";
import { ASSEMBLER_REGISTRY } from "../../core/assemblers/index.js";
import { createHubDirectory, safeWriteFile } from "../../core/io.js";
import { FillService } from "../../core/services/FillService.js";
import { getGlobalConfig } from "../../utils/config.js";

export const newCommand = new Command("new")
  .description("Create a new Hub with hybrid discovery")
  .action(async () => {
    const config = getGlobalConfig();

    const baseline = await inquirer.prompt([
      {
        type: "input",
        name: "topic",
        message: "Main Topic:",
        validate: (v) => !!v,
      },
      {
        type: "input",
        name: "goal",
        message: "Goal of the Hub:",
        default: "Master the basics",
      },
      {
        type: "input",
        name: "audience",
        message: "Target Audience:",
        default: "Intermediate Developers",
      },
      {
        type: "list",
        name: "language",
        message: "Language:",
        choices: ["English", "Spanish"],
        default: "English",
      },
    ]);

    const architect = new ArchitectAgent(config.apiKey!, baseline);
    console.log(chalk.blue("\n🧠 Architect is analyzing..."));

    let currentInput =
      "Analyze the baseline and ask me follow-up questions if needed.";
    let isComplete = false;

    while (!isComplete) {
      const {
        message,
        isComplete: final,
        brief,
        gapFound,
      } = await architect.chatWithUser(currentInput);

      if (gapFound) {
        console.log(`\n${chalk.red("Architect [GAP]:")} ${message}`);
        return;
      }

      console.log(`\n${chalk.green("Architect:")} ${message}`);

      if (final && brief) {
        const assembler = ASSEMBLER_REGISTRY[brief.assemblerId];
        const blueprint = await assembler.generateSkeleton(brief);
        const hubDir = await createHubDirectory(blueprint.hubId);

        const writerMap: Record<string, string> = {};
        blueprint.components.forEach((c) => {
          writerMap[c.header] = c.writerId;
        });

        const fileContent = [
          "---",
          `title: ${JSON.stringify(brief.topic)}`,
          'type: "hub"',
          `hubId: ${JSON.stringify(blueprint.hubId)}`,
          `goal: ${JSON.stringify(brief.goal)}`,
          `audience: ${JSON.stringify(brief.audience)}`,
          `language: ${JSON.stringify(brief.language)}`,
          `date: ${JSON.stringify(new Date().toISOString().split("T")[0])}`,
          `assemblerId: ${JSON.stringify(brief.assemblerId)}`,
          `personaId: ${JSON.stringify(brief.personaId)}`,
          `writerMap: ${JSON.stringify(writerMap, null, 2)}`,
          "---",
          "",
          `# ${brief.topic}`,
          "",
          ...blueprint.components.map(
            (c) =>
              `## ${c.header}\n\n> **TODO:** ${c.intent}\n\n*Pending generation...*\n`,
          ),
        ].join("\n");

        const filePath = path.join(hubDir, "hub.md");
        await safeWriteFile(filePath, fileContent);

        console.log(chalk.bold.green(`\n✅ Hub created at ${hubDir}`));

        // --- NEW SUMMARY BLOCK ---
        console.log(chalk.bold.cyan("\n📋 Blueprint Summary:"));
        blueprint.components.forEach((c, i) => {
          console.log(
            chalk.white(`${i + 1}. [${c.writerId.toUpperCase()}] `) +
              chalk.bold(c.header),
          );
          console.log(chalk.dim(`   Intent: ${c.intent}\n`));
        });
        // -------------------------

        const { shouldFill } = await inquirer.prompt([
          {
            type: "confirm",
            name: "shouldFill",
            message: "Does this structure look good? Generate content now?",
            default: true,
          },
        ]);

        if (shouldFill) {
          await FillService.execute(filePath, true);
          console.log(chalk.bold.cyan("\n🚀 Hub populated successfully!"));
        }

        isComplete = true;
        break;
      }

      const { next } = await inquirer.prompt([
        {
          type: "input",
          name: "next",
          message: chalk.cyan("You:"),
          validate: (val) => !!val || "Please enter a response.",
        },
      ]);
      currentInput = next;
    }
  });

// src/cli/commands/new.ts
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { ArchitectAgent } from "../../core/agents/Architect.js";
import { ASSEMBLER_REGISTRY } from "../../core/assemblers/index.js";
import { FillService } from "../../core/services/FillService.js";
import { IoService } from "../../core/services/IoService.js";
import { getGlobalConfig } from "../../utils/config.js";

export const newCommand = new Command("new")
  .description("Create a new Hub with intelligent structural discovery")
  .action(async () => {
    const config = getGlobalConfig();

    // 1. Initial Baseline Discovery
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
    console.log(chalk.blue("\n🧠 Architect is analyzing project scope..."));

    let currentInput =
      "Analyze the baseline and ask me follow-up questions if needed.";
    let isComplete = false;

    // 2. Discovery Loop
    while (!isComplete) {
      const response = await architect.chatWithUser(currentInput);

      if (response.gapFound) {
        console.log(`\n${chalk.red("Architect [GAP]:")} ${response.message}`);
        return;
      }

      console.log(`\n${chalk.green("Architect:")} ${response.message}`);

      if (response.isComplete && response.brief) {
        const brief = response.brief;

        // 3. Structural Intelligence Phase
        console.log(
          chalk.cyan(
            `\n🏗️  Requesting structure from ${chalk.bold(brief.assemblerId)}...`,
          ),
        );
        const assembler = ASSEMBLER_REGISTRY[brief.assemblerId];

        // The Assembler now performs its own LLM call to generate a dynamic blueprint
        const blueprint = await assembler.generateSkeleton(brief);
        const hubDir = await IoService.createHubDirectory(blueprint.hubId);

        // 4. Map Dynamic AI Headers to Writers
        const writerMap: Record<string, string> = {};
        blueprint.components.forEach((c) => {
          writerMap[c.header] = c.writerId;
        });

        // 5. Construct Markdown with Metadata
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
          `writerMap: ${JSON.stringify(writerMap)}`, // Map AI headers to strategies
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
        await IoService.safeWriteFile(filePath, fileContent);

        console.log(chalk.bold.green(`\n✅ Hub scaffolded at ${hubDir}`));

        // 6. Preview the AI-Generated Structure
        console.log(chalk.bold.cyan("\n📋 Intelligent Blueprint Summary:"));
        blueprint.components.forEach((c, i) => {
          const typeLabel = c.writerId === "code" ? "💻 CODE" : "📝 PROSE";
          console.log(
            chalk.white(`${i + 1}. [${typeLabel}] `) + chalk.bold(c.header),
          );
          console.log(chalk.dim(`   Instruction: ${c.intent}\n`));
        });

        const { shouldFill } = await inquirer.prompt([
          {
            type: "confirm",
            name: "shouldFill",
            message:
              "This structure was generated dynamically. Generate content now?",
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

      // Continue the interview
      const { next } = await inquirer.prompt([
        {
          type: "input",
          name: "next",
          message: chalk.cyan("You:"),
          validate: (val) => !!val || "Please provide a response to continue.",
        },
      ]);
      currentInput = next;
    }
  });

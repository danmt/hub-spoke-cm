import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { generateAnatomy } from "../../core/ai.js";
import { safeWriteFile } from "../../core/io.js";
import { reconstructMarkdown } from "../../core/parser.js";

export const newCommand = new Command("new")
  .description("Initialize a new Hub based on a topic")
  .argument("[topic]", "The main topic of the content hub")
  .action(async (topicArg) => {
    console.log(chalk.blue("✨ Welcome to the Hub & Spoke Architect"));

    // 1. Gather Inputs (SRS REQ-4.1.2)
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "topic",
        message: "What is the topic of this content hub?",
        default: topicArg,
        when: !topicArg,
      },
      {
        type: "input",
        name: "goal",
        message: "What is the primary goal of this article?",
        default: "To provide a comprehensive technical guide.",
      },
      {
        type: "input",
        name: "audience",
        message: "Who is the target audience?",
        default: "Intermediate developers.",
      },
    ]);

    const topic = topicArg || answers.topic;
    const { goal, audience } = answers;

    // 2. Generate Anatomy via AI (SRS REQ-4.1.3)
    console.log(
      chalk.yellow(
        `\n🧠 Consultating Gemini Strategy Engine for "${topic}"...\n`,
      ),
    );

    try {
      const anatomy = await generateAnatomy(topic, goal, audience);

      // Display Proposal
      console.log(chalk.cyan("Proposed Structure:"));
      anatomy.components.forEach((c) => {
        console.log(`  - ${chalk.bold(c.header)} (${c.id})`);
      });
      console.log(chalk.gray(`  (Saved to ${anatomy.hubId}/anatomy.json)`));

      // 3. Confirm & Scaffold (SRS REQ-4.1.4)
      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message:
            "Does this structure look good? (We will generate the skeleton files)",
          default: true,
        },
      ]);

      if (!confirm) {
        console.log(
          chalk.red(
            "Aborted. Try running the command again with more specific details.",
          ),
        );
        return;
      }

      // 4. Write Files
      const hubDir = path.join(process.cwd(), anatomy.hubId);

      // A. Write anatomy.json
      await safeWriteFile(
        path.join(hubDir, "anatomy.json"),
        JSON.stringify(anatomy, null, 2),
      );

      // B. Write hub.md Skeleton
      // We map the components to sections for our parser's reconstructor
      const sections: Record<string, string> = {};
      const order: string[] = [];

      anatomy.components.forEach((comp) => {
        sections[comp.header] = `\n\n*Content pending generation...*`;
        order.push(comp.header);
      });

      // Construct Frontmatter
      const frontmatter = [
        "---",
        `title: "${topic}"`,
        'type: "hub"',
        `hubId: "${anatomy.hubId}"`,
        'version: "1.0"',
        `date: "${new Date().toISOString().split("T")[0]}"`,
        "---",
        "",
        `# ${topic}`,
        "",
        `> **Goal:** ${goal}`,
        "",
      ].join("\n");

      const body = reconstructMarkdown(sections, order);
      await safeWriteFile(path.join(hubDir, "hub.md"), frontmatter + body);

      // C. Create Spokes directory
      await safeWriteFile(path.join(hubDir, "spokes", ".gitkeep"), "");

      console.log(
        chalk.green(`\n✅ Hub created successfully at ./${anatomy.hubId}`),
      );
      console.log(
        chalk.white(`   Run `) +
          chalk.yellow(`hub check`) +
          chalk.white(` inside the folder to verify.`),
      );
    } catch (error) {
      console.error(chalk.red("Failed to generate hub:"), error);
    }
  });

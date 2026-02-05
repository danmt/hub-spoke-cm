// src/cli/commands/spawn.ts
import chalk from "chalk";
import { Command } from "commander";
import fs from "fs/promises";
import inquirer from "inquirer";
import path from "path";
import { ArchitectAgent } from "../../core/agents/Architect.js";
import { ASSEMBLER_REGISTRY } from "../../core/assemblers/index.js";
import { FillService } from "../../core/services/FillService.js";
import { IoService } from "../../core/services/IoService.js";
import { ParserService } from "../../core/services/ParserService.js";
import { getGlobalConfig } from "../../utils/config.js";

export const spawnCommand = new Command("spawn")
  .description("Create a new Spoke article by expanding a Hub section")
  .action(async () => {
    try {
      const config = getGlobalConfig();
      const rootDir = await IoService.findHubRoot(process.cwd());
      const hubMeta = await IoService.readHubMetadata(rootDir);
      const hubRaw = await IoService.readHubFile(rootDir);
      const parsedHub = ParserService.parseMarkdown(hubRaw);

      // 1. Identify Sections available for expansion
      const sections = Object.keys(parsedHub.sections);
      if (sections.length === 0) {
        throw new Error("No sections found in hub.md to expand.");
      }

      // 2. User selects the section to "Spawn"
      const { targetSection } = await inquirer.prompt([
        {
          type: "list",
          name: "targetSection",
          message: "Select a Hub section to expand into a dedicated Spoke:",
          choices: sections,
        },
      ]);

      console.log(chalk.blue(`\n🌱 Spawning Spoke for: "${targetSection}"`));
      console.log(chalk.gray(`   Inheriting Persona: ${hubMeta.personaId}`));

      // 3. Initialize Architect with Hub Context
      const architect = new ArchitectAgent(config.apiKey!, {
        topic: targetSection,
        language: hubMeta.language,
        audience: hubMeta.audience,
        goal: `Expand on the concepts of '${targetSection}' previously introduced in the ${hubMeta.title} hub.`,
        personaId: hubMeta.personaId,
      });

      console.log(
        chalk.cyan("🧠 Architect is designing the Spoke structure..."),
      );

      let currentInput = `Plan a Spoke article for "${targetSection}". Inherit Persona: ${hubMeta.personaId}.`;
      let isComplete = false;

      // 4. Discovery & Confirmation Loop (Same as 'new' command)
      while (!isComplete) {
        const response = await architect.chatWithUser(currentInput);

        if (response.gapFound) {
          console.log(`\n${chalk.red("Architect [GAP]:")} ${response.message}`);
          return;
        }

        console.log(`\n${chalk.green("Architect:")} ${response.message}`);

        if (response.isComplete && response.brief) {
          const brief = response.brief;

          // 5. Structural Intelligence Phase
          const assembler =
            ASSEMBLER_REGISTRY[brief.assemblerId] ||
            ASSEMBLER_REGISTRY["tutorial"];
          const blueprint = await assembler.generateSkeleton(brief);

          const writerMap: Record<string, string> = {};
          blueprint.components.forEach((c) => {
            writerMap[c.header] = c.writerId;
          });

          // 6. Construct Spoke Content
          const fileName = `${blueprint.hubId}.md`;
          const spokesDir = path.join(rootDir, "spokes");
          await fs.mkdir(spokesDir, { recursive: true });

          const fileContent = [
            "---",
            `title: ${JSON.stringify(targetSection)}`,
            'type: "spoke"',
            `hubId: ${JSON.stringify(hubMeta.hubId)}`,
            `componentId: ${JSON.stringify(blueprint.hubId)}`,
            `goal: ${JSON.stringify(brief.goal)}`,
            `audience: ${JSON.stringify(hubMeta.audience)}`,
            `language: ${JSON.stringify(hubMeta.language)}`,
            `date: ${JSON.stringify(new Date().toISOString().split("T")[0])}`,
            `personaId: ${JSON.stringify(hubMeta.personaId)}`,
            `writerMap: ${JSON.stringify(writerMap)}`,
            "---",
            "",
            `# ${targetSection}`,
            "",
            ...blueprint.components.map(
              (c) =>
                `## ${c.header}\n\n> **TODO:** ${c.intent}\n\n*Pending generation...*\n`,
            ),
          ].join("\n");

          const filePath = path.join(spokesDir, fileName);
          await IoService.safeWriteFile(filePath, fileContent);

          console.log(
            chalk.bold.green(`\n✅ Spoke created: spokes/${fileName}`),
          );

          const { shouldFill } = await inquirer.prompt([
            {
              type: "confirm",
              name: "shouldFill",
              message:
                "Would you like to generate the content for this Spoke now?",
              default: true,
            },
          ]);

          if (shouldFill) {
            await FillService.execute(filePath, true);
            console.log(chalk.bold.cyan("\n🚀 Spoke populated successfully!"));
          }

          isComplete = true;
          break;
        } else {
          // Keep the conversation going if not finalized
          const { next } = await inquirer.prompt([
            {
              type: "input",
              name: "next",
              message: chalk.cyan("You (say 'Proceed' to confirm):"),
              validate: (val) => !!val || "Please provide a response.",
            },
          ]);
          currentInput = next;
        }
      }
    } catch (error) {
      console.error(
        chalk.red("\n❌ Spawn Error:"),
        error instanceof Error ? error.message : String(error),
      );
    }
  });

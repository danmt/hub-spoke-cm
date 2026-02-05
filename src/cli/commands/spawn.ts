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

      const sections = Object.keys(parsedHub.sections);
      if (sections.length === 0)
        throw new Error("No sections found in hub.md.");

      const { targetSection } = await inquirer.prompt([
        {
          type: "list",
          name: "targetSection",
          message: "Select a Hub section to expand into a dedicated Spoke:",
          choices: sections,
        },
      ]);

      const architect = new ArchitectAgent(config.apiKey!, {
        topic: targetSection,
        language: hubMeta.language,
        audience: hubMeta.audience,
        goal: `Expand on '${targetSection}' from the ${hubMeta.title} hub.`,
        personaId: hubMeta.personaId,
      });

      let currentInput = `Plan a Spoke for "${targetSection}". Persona: ${hubMeta.personaId}.`;
      let isComplete = false;

      while (!isComplete) {
        try {
          const response = await architect.chatWithUser(currentInput);
          if (response.gapFound)
            return console.log(chalk.red("\n[GAP]: ") + response.message);
          console.log(`\n${chalk.green("Architect:")} ${response.message}`);

          if (response.isComplete && response.brief) {
            const brief = response.brief;
            const assembler =
              ASSEMBLER_REGISTRY[brief.assemblerId] ||
              ASSEMBLER_REGISTRY["tutorial"];

            // Generate Skeleton inside the retry-able block
            const blueprint = await assembler.generateSkeleton(brief);

            // Spoke UX: Brief summary of the structure
            console.log(
              chalk.cyan(
                `\n🏗️  Spoke Structure Generated (${blueprint.components.length} sections)`,
              ),
            );

            const writerMap: Record<string, string> = {};
            blueprint.components.forEach((c) => {
              writerMap[c.header] = c.writerId;
            });

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
                message: "Generate content now?",
                default: true,
              },
            ]);

            if (shouldFill) await FillService.execute(filePath, true);
            isComplete = true;
          } else {
            const { next } = await inquirer.prompt([
              {
                type: "input",
                name: "next",
                message: chalk.cyan("You:"),
                validate: (val) => !!val || "Input required.",
              },
            ]);
            currentInput = next;
          }
        } catch (error) {
          console.error(chalk.red("\n❌ Architect/Assembler Error:"), error);
          const { retry } = await inquirer.prompt([
            {
              type: "confirm",
              name: "retry",
              message: "Operation failed. Retry last step?",
              default: true,
            },
          ]);
          if (!retry) return;
        }
      }
    } catch (error) {
      console.error(chalk.red("\n❌ Spawn Error:"), error);
    }
  });

// src/cli/commands/spawn.ts
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { ArchitectAgent } from "../../core/agents/Architect.js";
import { ASSEMBLER_REGISTRY } from "../../core/assemblers/index.js";
import { findHubRoot, readHubMetadata, safeWriteFile } from "../../core/io.js";
import { FillService } from "../../core/services/FillService.js";
import { getGlobalConfig } from "../../utils/config.js";

export const spawnCommand = new Command("spawn")
  .description("Create a new Spoke article inheriting Hub context")
  .argument("<topic>", "The specific topic for this Spoke")
  .action(async (topic) => {
    try {
      const config = getGlobalConfig();
      const rootDir = await findHubRoot(process.cwd());
      const hubMeta = await readHubMetadata(rootDir);

      console.log(chalk.blue(`\n🌱 Spawning Spoke: "${topic}"`));
      console.log(chalk.gray(`   Inheriting Persona: ${hubMeta.personaId}`));

      // 1. Architect Planning
      const architect = new ArchitectAgent(config.apiKey!, {
        topic: topic,
        language: hubMeta.language,
        audience: hubMeta.audience,
        goal: hubMeta.goal,
      });

      console.log(
        chalk.cyan("🧠 Architect is designing the Spoke structure..."),
      );

      const { brief, message } = await architect.chatWithUser(
        `Finalize a Spoke brief for "${topic}". Use the same Persona (${hubMeta.personaId}) and a suitable Assembler.`,
      );

      if (!brief) {
        console.log(chalk.yellow(`\nArchitect needs more info: ${message}`));
        return; // In a real scenario, you'd wrap this in a loop like 'new'
      }

      // 2. Assemble Structure
      const assembler =
        ASSEMBLER_REGISTRY[brief.assemblerId] || ASSEMBLER_REGISTRY["tutorial"];
      const blueprint = await assembler.generateSkeleton(brief);

      const writerMap: Record<string, string> = {};
      blueprint.components.forEach((c) => {
        writerMap[c.header] = c.writerId;
      });

      // 3. Construct Spoke Content
      const fileName = `${blueprint.hubId}.md`;
      const fileContent = [
        "---",
        `title: ${JSON.stringify(topic)}`,
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
        `# ${topic}`,
        "",
        ...blueprint.components.map(
          (c) =>
            `## ${c.header}\n\n> **TODO:** ${c.intent}\n\n*Pending generation...*\n`,
        ),
      ].join("\n");

      const filePath = path.join(rootDir, fileName);
      await safeWriteFile(filePath, fileContent);

      console.log(chalk.bold.green(`\n✅ Spoke created: ${fileName}`));

      // 4. Optional Auto-Fill
      const { shouldFill } = await inquirer.prompt([
        {
          type: "confirm",
          name: "shouldFill",
          message: "Would you like to generate the content for this Spoke now?",
          default: true,
        },
      ]);

      if (shouldFill) {
        await FillService.execute(filePath, true);
        console.log(chalk.bold.cyan("\n🚀 Spoke populated successfully!"));
      }
    } catch (error) {
      console.error(
        chalk.red("\n❌ Spawn Error:"),
        error instanceof Error ? error.message : String(error),
      );
    }
  });

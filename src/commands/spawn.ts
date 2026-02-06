// src/cli/commands/spawn.ts
import { GoogleGenAI } from "@google/genai";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { ArchitectAgent } from "../agents/Architect.js";
import { FillService } from "../services/FillService.js";
import { IoService } from "../services/IoService.js";
import { ParserService } from "../services/ParserService.js";
import { RegistryService } from "../services/RegistryService.js";
import { ValidationService } from "../services/ValidationService.js";
import { getGlobalConfig } from "../utils/config.js";

export const spawnCommand = new Command("spawn")
  .description("Create a new Spoke article by expanding a Hub section")
  .action(async () => {
    try {
      const config = getGlobalConfig();
      const workspaceRoot = await IoService.findWorkspaceRoot(process.cwd());
      const rawArtifacts = await RegistryService.getAllArtifacts();
      const client = new GoogleGenAI({ apiKey: config.apiKey! });
      const agents = RegistryService.initializeAgents(
        config,
        client,
        rawArtifacts,
      );

      const hubs = await IoService.findAllHubsInWorkspace(workspaceRoot);
      if (hubs.length === 0) throw new Error("No hubs found.");

      const { targetHub } = await inquirer.prompt([
        {
          type: "list",
          name: "targetHub",
          message: "Select parent Hub:",
          choices: hubs,
        },
      ]);
      const rootDir = path.join(workspaceRoot, "posts", targetHub);
      const hubMeta = await IoService.readHubMetadata(rootDir);
      const hubRaw = await IoService.readHubFile(rootDir);
      const parsedHub = ParserService.parseMarkdown(hubRaw);

      const sections = Object.keys(parsedHub.sections);
      const { targetSection } = await inquirer.prompt([
        {
          type: "list",
          name: "targetSection",
          message: "Select Hub section to expand:",
          choices: sections,
        },
      ]);

      const architect = new ArchitectAgent(
        client,
        RegistryService.toManifest(agents),
        {
          topic: targetSection,
          language: hubMeta.language,
          audience: hubMeta.audience,
          goal: `Expand on '${targetSection}' from the ${hubMeta.title} hub.`,
          personaId: hubMeta.personaId,
        },
      );

      let currentInput = `Plan a Spoke for "${targetSection}".`;
      let isComplete = false;

      while (!isComplete) {
        const response = await architect.chatWithUser(currentInput);
        if (response.isComplete && response.brief) {
          const brief = response.brief;
          const assemblers = RegistryService.getAgentsByType(
            agents,
            "assembler",
          );
          const assembler = assemblers.find(
            (a) => a.artifact.id === brief.assemblerId,
          );
          if (!assembler)
            throw new Error(`Assembler ${brief.assemblerId} not found.`);

          const blueprint = await assembler.agent.generateSkeleton(brief);
          const blueprintData: Record<string, any> = {};
          const writerMap: Record<string, string> = {};

          blueprint.components.forEach((c) => {
            blueprintData[c.header] = {
              intent: c.intent,
              writerId: c.writerId,
            };
            writerMap[c.header] = c.writerId;
          });

          const fileName = `${blueprint.hubId}.md`;
          const filePath = path.join(rootDir, "spokes", fileName);

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
            `blueprint: ${JSON.stringify(blueprintData)}`,
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
          if (shouldFill) {
            await FillService.execute(config, client, filePath, true);
            console.log(
              chalk.cyan("\n🚀 Spoke populated. Running stepped audit..."),
            );

            const auditors = RegistryService.getAgentsByType(agents, "auditor");
            if (auditors.length > 0) {
              await ValidationService.runFullAudit(
                config,
                client,
                filePath,
                auditors[0].agent,
              );
            }
          }
          isComplete = true;
        } else {
          const { next } = await inquirer.prompt([
            {
              type: "input",
              name: "next",
              message: chalk.cyan("You:"),
              validate: (v) => !!v,
            },
          ]);
          currentInput = next;
        }
      }
    } catch (error) {
      console.error(chalk.red("\n❌ Spawn Error:"), error);
    }
  });

// src/commands/spawn.ts
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { Architect } from "../agents/Architect.js";
import { executeCliFillAction } from "../presets/executeCliFillAction.js";
import { ContextService } from "../services/ContextService.js";
import { IoService } from "../services/IoService.js";
import { ParserService } from "../services/ParserService.js";
import { RegistryService } from "../services/RegistryService.js";
import { cliConfirmOrFeedback } from "../utils/cliConfirmOrFeedback.js";
import { cliRetryHandler } from "../utils/cliRetryHandler.js";
import { indentText } from "../utils/identText.js";

export const spawnCommand = new Command("spawn")
  .description("Create a new Spoke article by expanding a Hub section")
  .action(async () => {
    try {
      const workspaceRoot = await IoService.findWorkspaceRoot(process.cwd());
      const rawArtifacts = await RegistryService.getAllArtifacts();
      const agents = RegistryService.initializeAgents(rawArtifacts);

      try {
        RegistryService.validateIntegrity(agents);
      } catch (error) {
        console.error(chalk.red("\n❌ Registry Integrity Check Failed:"));
        console.error(chalk.yellow((error as Error).message));
        process.exit(1);
      }

      const assemblers = RegistryService.getAgentsByType(agents, "assembler");
      const personas = RegistryService.getAgentsByType(agents, "persona");
      const writers = RegistryService.getAgentsByType(agents, "writer");

      const manifest = RegistryService.toManifest(agents);

      const { rootDir } = await ContextService.resolveHubContext(
        workspaceRoot,
        async (hubs) => {
          const { targetHub } = await inquirer.prompt([
            {
              type: "list",
              name: "targetHub",
              message: "Select Hub:",
              choices: hubs,
            },
          ]);
          return targetHub;
        },
      );
      const hubMeta = await IoService.readHubMetadata(rootDir);
      const hubRaw = await IoService.readHubFile(rootDir);
      const parsedHub = ParserService.parseMarkdown(hubRaw);

      const sections = Object.keys(parsedHub.sections);
      const { section } = await inquirer.prompt([
        {
          type: "list",
          name: "section",
          message: "Select Hub section to expand:",
          choices: sections,
        },
      ]);

      const architect = new Architect(manifest, {
        topic: section,
        language: hubMeta.language,
        audience: hubMeta.audience,
        goal: `Expand on '${section}' from the ${hubMeta.title} hub.`,
        personaId: hubMeta.personaId,
      });

      const architecture = await architect.architect({
        input: `Plan a Spoke for "${section}".`,
        interact: async ({ message, brief }) => {
          console.log(`\n${chalk.green("Architect:")} ${message}`);
          console.log(chalk.dim(`\n--- Current Proposal ---`));
          console.log(`${chalk.yellow("Topic:")} ${brief.topic}`);
          console.log(`${chalk.yellow("Goal:")} ${brief.goal}`);
          console.log(`${chalk.yellow("Audience:")} ${brief.audience}`);
          console.log(`${chalk.yellow("Assembler:")} ${brief.assemblerId}`);
          console.log(`${chalk.yellow("Persona:")}   ${brief.personaId}\n`);

          return cliConfirmOrFeedback();
        },
        onRetry: cliRetryHandler,
        onThinking: () =>
          console.log(chalk.blue("\n🧠 Architect is thinking...")),
      });

      const assembler = assemblers.find(
        (a) => a.artifact.id === architecture.brief.assemblerId,
      );

      if (!assembler) {
        throw new Error(
          `Assembler "${architecture.brief.assemblerId}" not found in /agents/assemblers. ` +
            `Available: ${assemblers.map((a) => a.artifact.id).join(", ")}`,
        );
      }

      const assembly = await assembler.agent.assemble({
        audience: architecture.brief.audience,
        goal: architecture.brief.goal,
        topic: architecture.brief.topic,
        interact: async ({ blueprint }) => {
          console.log(chalk.bold.cyan("\n📋 Intelligent Blueprint Summary:"));
          console.log(`${chalk.yellow("Title:")} ${architecture.brief.topic}`);
          console.log(`${chalk.yellow("Hub ID:")} ${blueprint.hubId}`);

          blueprint.components.forEach((c, i) => {
            console.log(
              chalk.white(`#${i + 1} [${c.writerId.toUpperCase()}] `) +
                chalk.bold(c.header),
            );
            console.log(
              indentText(`${chalk.yellow("Bridge:")} ${c.bridge}`, 4),
            );
            console.log(
              indentText(`${chalk.yellow("Intent:")} ${c.intent}`, 4),
            );
          });

          return cliConfirmOrFeedback();
        },
      });

      console.log(
        chalk.cyan(
          `\n🏗️  Spoke Structure Generated (${assembly.blueprint.components.length} sections)`,
        ),
      );

      const fileContent = ParserService.generateScaffold(
        "spoke",
        architecture.brief,
        assembly.blueprint,
        hubMeta.hubId,
      );
      const filePath = path.join(
        rootDir,
        "spokes",
        `${assembly.blueprint.hubId}.md`,
      );
      await IoService.safeWriteFile(filePath, fileContent);

      console.log(chalk.bold.green(`\n✅ Spoke created: spokes/${filePath}`));

      const { shouldFill } = await inquirer.prompt([
        {
          type: "confirm",
          name: "shouldFill",
          message: "Generate content now?",
          default: true,
        },
      ]);

      if (!shouldFill) return;

      const persona = personas.find(
        (p) => p.artifact.id === architecture.brief.personaId,
      );

      if (!persona) {
        throw new Error(
          `Persona "${architecture.brief.personaId}" not found in workspace. ` +
            `Available: ${personas.map((a) => a.artifact.id).join(", ")}`,
        );
      }

      await executeCliFillAction(
        persona.agent,
        writers.map((writer) => writer.agent),
        filePath,
        fileContent,
        assembly.blueprint.components.map((c) => c.id),
      );
    } catch (error) {
      console.error(chalk.red("\n❌ Command `spawn` Error:"), error);
    }
  });

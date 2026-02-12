// src/commands/new.ts
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { Architect } from "../agents/Architect.js";
import { executeCliFillAction } from "../presets/executeCliFillAction.js";
import { IoService } from "../services/IoService.js";
import { ParserService } from "../services/ParserService.js";
import { RegistryService } from "../services/RegistryService.js";
import { cliConfirmOrFeedback } from "../utils/cliConfirmOrFeedback.js";
import { cliRetryHandler } from "../utils/cliRetryHandler.js";
import { indentText } from "../utils/identText.js";

export const newCommand = new Command("new")
  .description("Create a new Hub inside the workspace /posts directory")
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

      const personas = RegistryService.getAgentsByType(agents, "persona");
      const writers = RegistryService.getAgentsByType(agents, "writer");
      const assemblers = RegistryService.getAgentsByType(agents, "assembler");
      const manifest = RegistryService.toManifest(agents);

      console.log(chalk.gray(`\n📂 Active Workspace: ${workspaceRoot}`));

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

      const architect = new Architect(manifest, baseline);

      const architecture = await architect.architect({
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
          `Assembler "${architecture.brief.assemblerId}" not found in workspace. ` +
            `Available: ${assemblers.map((a) => a.artifact.id).join(", ")}`,
        );
      }

      console.log(
        chalk.cyan(
          `\n🏗️  Requesting structure from ${chalk.bold(architecture.brief.assemblerId)}...`,
        ),
      );

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
        onRetry: cliRetryHandler,
      });

      const hubDir = await IoService.createHubDirectory(
        assembly.blueprint.hubId,
      );
      const filePath = path.join(hubDir, "hub.md");
      const fileContent = ParserService.generateScaffold(
        "hub",
        architecture.brief,
        assembly.blueprint,
      );
      await IoService.safeWriteFile(filePath, fileContent);

      console.log(
        chalk.bold.green(
          `✅ Hub scaffolded at posts/${assembly.blueprint.hubId}\n`,
        ),
      );

      const { shouldFill } = await inquirer.prompt([
        {
          type: "confirm",
          name: "shouldFill",
          message: "Generate content now?",
          default: true,
        },
      ]);

      if (!shouldFill) {
        return;
      }

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
      console.error(chalk.red("\n❌ Command `new` Error:"), error);
    }
  });

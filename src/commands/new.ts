// src/commands/new.ts
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import { Architect } from "../agents/Architect.js";
import { executeCliCreateHubAction } from "../presets/executeCliCreateHubAction.js";
import { executeCliFillAction } from "../presets/executeCliFillAction.js";
import { IoService } from "../services/IoService.js";
import {
  getAgentsByType,
  RegistryService,
} from "../services/RegistryService.js";

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

      const personas = getAgentsByType(agents, "persona");
      const writers = getAgentsByType(agents, "writer");
      const assemblers = getAgentsByType(agents, "assembler");
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

      const { architecture, assembly, filePath, fileContent } =
        await executeCliCreateHubAction(
          architect,
          assemblers.map((a) => a.agent),
          personas.map((a) => a.agent),
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

// src/presets/executeCliCreateHubAction.ts
import {
  AgentPair,
  ArchitectResponse,
  AssembleResponse,
  CreateHubAction,
  IoService,
  ParserService,
} from "@hub-spoke/core";
import chalk from "chalk";
import inquirer from "inquirer";
import path from "path";
import { confirmOrFeedback } from "../utils/confirmOrFeedback.js";
import { indentText } from "../utils/identText.js";
import { retryHandler } from "../utils/retryHandler.js";

export interface ExecuteCreateHubActionResult {
  architecture: ArchitectResponse;
  assembly: AssembleResponse;
  filePath: string;
  fileContent: string;
}

export async function executeCliCreateHubAction(
  apiKey: string,
  model: string,
  manifest: string,
  agents: AgentPair[],
  workspaceRoot: string,
): Promise<ExecuteCreateHubActionResult> {
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

  const action = new CreateHubAction(apiKey, model, manifest, baseline, agents)
    .onArchitecting(() =>
      console.log(chalk.blue("\n🧠 Architect is thinking...")),
    )
    .onArchitect(({ message, brief }) => {
      console.log(`\n${chalk.green("Architect:")} ${message}`);
      console.log(chalk.dim(`\n--- Current Proposal ---`));
      console.log(`${chalk.yellow("Topic:")} ${brief.topic}`);
      console.log(`${chalk.yellow("Goal:")} ${brief.goal}`);
      console.log(`${chalk.yellow("Audience:")} ${brief.audience}`);
      console.log(`${chalk.yellow("Assembler:")} ${brief.assemblerId}`);
      console.log(`${chalk.yellow("Persona:")}   ${brief.personaId}\n`);
      return confirmOrFeedback();
    })
    .onAssembling((assemblerId) =>
      console.log(
        chalk.cyan(
          `\n🏗️  Requesting structure from ${chalk.bold(assemblerId)}...`,
        ),
      ),
    )
    .onAssembler(({ blueprint }) => {
      console.log(chalk.bold.cyan("\n📋 Intelligent Blueprint Summary:"));
      console.log(`${chalk.yellow("Hub ID:")} ${blueprint.hubId}`);

      blueprint.components.forEach((c, i) => {
        console.log(
          chalk.white(`#${i + 1} [${c.writerId.toUpperCase()}] `) +
            chalk.bold(c.header),
        );
        console.log(indentText(`${chalk.yellow("Bridge:")} ${c.bridge}`, 4));
        console.log(indentText(`${chalk.yellow("Intent:")} ${c.intent}`, 4));
      });

      return confirmOrFeedback();
    })
    .onRephrasing((personaId) => {
      console.log(
        chalk.magenta(`\n✨ ${chalk.bold(personaId)} is styling...\n`),
      );
    })
    .onRephrase(async ({ header, content }) => {
      console.log(indentText(chalk.bold.cyan(`# ${header}\n`), 4));
      console.log(indentText(chalk.white(`${content}\n`), 4));
      return await confirmOrFeedback();
    })
    .onRetry(retryHandler);

  const { assembly, architecture, personification } = await action.execute();

  const hubDir = await IoService.createHubDirectory(
    workspaceRoot,
    assembly.blueprint.hubId,
  );
  const filePath = path.join(hubDir, "hub.md");
  const fileContent = ParserService.generateScaffold(
    architecture.brief,
    assembly.blueprint,
    personification.header,
    personification.content,
  );
  await IoService.safeWriteFile(filePath, fileContent);

  console.log(
    chalk.bold.green(
      `✅ Hub scaffolded at posts/${assembly.blueprint.hubId}\n`,
    ),
  );

  return { assembly, architecture, filePath, fileContent };
}

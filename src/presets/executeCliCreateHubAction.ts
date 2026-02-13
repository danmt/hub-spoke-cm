// src/presets/executeCliCreateHubAction.ts
import chalk from "chalk";
import path from "path";
import { CreateHubAction } from "../actions/CreateHubAction.js";
import { Architect, ArchitectResponse } from "../agents/Architect.js";
import { Assembler, AssembleResponse } from "../agents/Assembler.js";
import { Persona } from "../agents/Persona.js";
import { IoService } from "../services/IoService.js";
import { ParserService } from "../services/ParserService.js";
import { cliConfirmOrFeedback } from "../utils/cliConfirmOrFeedback.js";
import { cliRetryHandler } from "../utils/cliRetryHandler.js";
import { indentText } from "../utils/identText.js";

export interface ExecuteCreateHubActionResult {
  architecture: ArchitectResponse;
  assembly: AssembleResponse;
  filePath: string;
  fileContent: string;
}

export async function executeCliCreateHubAction(
  architect: Architect,
  assemblers: Assembler[],
  personas: Persona[],
): Promise<ExecuteCreateHubActionResult> {
  const action = new CreateHubAction(architect, assemblers, personas)
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
      return cliConfirmOrFeedback();
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

      return cliConfirmOrFeedback();
    })
    .onRephrasing((personaId) => {
      console.log(
        chalk.magenta(`\n✨ ${chalk.bold(personaId)} is styling...\n`),
      );
    })
    .onRephrase(async ({ header, content }) => {
      console.log(indentText(chalk.bold.cyan(`# ${header}\n`), 4));
      console.log(indentText(chalk.white(`${content}\n`), 4));
      return await cliConfirmOrFeedback();
    })
    .onRetry(cliRetryHandler);

  const { assembly, architecture, personification } = await action.execute();

  const hubDir = await IoService.createHubDirectory(assembly.blueprint.hubId);
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

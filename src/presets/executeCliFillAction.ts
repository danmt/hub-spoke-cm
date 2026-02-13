// src/cli/presets/cliFillAction.ts
import chalk from "chalk";
import { FillAction } from "../actions/FillAction.js";
import { Persona } from "../agents/Persona.js";
import { Writer } from "../agents/Writer.js";
import { IoService } from "../services/IoService.js";
import { cliConfirmOrFeedback } from "../utils/cliConfirmOrFeedback.js";
import { cliRetryHandler } from "../utils/cliRetryHandler.js";
import { indentText } from "../utils/identText.js";

export async function executeCliFillAction(
  persona: Persona,
  writers: Writer[],
  filePath: string,
  content: string,
  sectionIdsToFill: string[],
): Promise<void> {
  const fillAction = new FillAction(persona, writers)
    .onStart((id) =>
      console.log(chalk.green(`\n🔄 Generating section: ${chalk.bold(id)}`)),
    )
    .onWriting(({ writerId }) => {
      console.log(
        chalk.blue(`\n🧠 ${chalk.bold(writerId)} writing... (Step 1/2)\n`),
      );
    })
    .onWrite(async ({ header, content }) => {
      console.log(indentText(chalk.bold.cyan(`## ${header}\n`), 4));
      console.log(indentText(chalk.white(`${content}\n`), 4));
      return await cliConfirmOrFeedback();
    })
    .onRephrasing(({ personaId }) => {
      console.log(
        chalk.magenta(
          `\n✨ ${chalk.bold(personaId)} is styling... (Step 2/2)\n`,
        ),
      );
    })
    .onRephrase(async ({ header, content }) => {
      console.log(indentText(chalk.bold.cyan(`${header}\n`), 4));
      console.log(indentText(chalk.white(`${content}\n`), 4));
      return await cliConfirmOrFeedback();
    })
    .onRetry(async (error) => {
      return await cliRetryHandler(error);
    });

  const populatedMarkdown = await fillAction.execute({
    content,
    sectionIdsToFill,
  });

  await IoService.safeWriteFile(filePath, populatedMarkdown);
  console.log(chalk.green(`\n✅ File saved: ${filePath}`));
}

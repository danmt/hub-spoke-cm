// src/cli/presets/cliFillAction.ts
import chalk from "chalk";
import { FillAction } from "../actions/FillAction.js";
import { IoService } from "../services/IoService.js";
import { ParserService } from "../services/ParserService.js";
import { AgentPair } from "../services/RegistryService.js";
import { cliConfirmOrFeedback } from "../utils/cliConfirmOrFeedback.js";
import { cliRetryHandler } from "../utils/cliRetryHandler.js";
import { indentText } from "../utils/identText.js";

export async function executeCliFillAction(
  agents: AgentPair[],
  personaId: string,
  filePath: string,
  rawContent: string,
  sectionIdsToFill: string[],
): Promise<void> {
  const parsed = ParserService.parseMarkdown(rawContent);
  const sectionIds = Object.keys(parsed.sections);
  const updatedSections = { ...parsed.sections };

  const fillAction = new FillAction(personaId, agents)
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

  for (const sectionId of sectionIdsToFill) {
    const blueprint = parsed.frontmatter.blueprint[sectionId];

    const result = await fillAction.execute({
      sectionId,
      sectionBody: updatedSections[sectionId],
      blueprint,
      parentMetadata: {
        title: parsed.frontmatter.title,
        goal: parsed.frontmatter.goal,
        audience: parsed.frontmatter.audience,
      },
      isFirst: sectionId === sectionIds[0],
      isLast: sectionId === sectionIds[sectionIds.length - 1],
    });

    updatedSections[sectionId] = result;
  }

  const finalMarkdown = ParserService.reconstructMarkdown(
    parsed.frontmatter,
    updatedSections,
  );

  await IoService.safeWriteFile(filePath, finalMarkdown);
  console.log(
    chalk.green(`\n✅ File successfully updated: ${chalk.bold(filePath)}`),
  );
}

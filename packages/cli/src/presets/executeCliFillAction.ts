// packages/cli/src/presets/executeCliFillAction.ts
import {
  AgentPair,
  ContentFrontmatter,
  FillAction,
  IoService,
  ParserService,
} from "@hub-spoke/core";
import chalk from "chalk";
import { confirmOrFeedback } from "../utils/confirmOrFeedback.js";
import { indentText } from "../utils/identText.js";
import { retryHandler } from "../utils/retryHandler.js";

const TODO_REGEX = />\s*\*\*?TODO:?\*?\s*(.*)/i;

export async function executeCliFillAction(
  workspaceRoot: string,
  agents: AgentPair[],
  frontmatter: ContentFrontmatter,
  sections: Record<string, string>,
  filePath: string,
): Promise<void> {
  const sectionIds = Object.keys(sections);
  const updatedSections = { ...sections };

  const pendingSectionIds = sectionIds.filter((id) =>
    TODO_REGEX.test(updatedSections[id]),
  );

  if (pendingSectionIds.length === 0) {
    console.log(chalk.yellow("\n✨ All sections are already filled."));
    return;
  }

  const fillAction = new FillAction(
    workspaceRoot,
    frontmatter.personaId,
    agents,
  )
    .onStart((id) =>
      console.log(chalk.green(`\n🔄 Generating: ${chalk.bold(id)}`)),
    )
    .onWrite(async ({ header, content }) => {
      console.log(indentText(chalk.bold.cyan(`## ${header}\n`), 4));
      console.log(indentText(chalk.white(`${content}\n`), 4));
      return await confirmOrFeedback();
    })
    .onRephrase(async ({ header, content }) => {
      console.log(indentText(chalk.bold.cyan(`${header}\n`), 4));
      console.log(indentText(chalk.white(`${content}\n`), 4));
      return await confirmOrFeedback();
    })
    .onRetry(retryHandler);

  for (const sectionId of pendingSectionIds) {
    const result = await fillAction.execute({
      sectionId,
      sectionBody: updatedSections[sectionId],
      blueprint: frontmatter.blueprint[sectionId],
      topic: frontmatter.topic,
      goal: frontmatter.goal,
      audience: frontmatter.audience,
      isFirst: sectionId === sectionIds[0],
      isLast: sectionId === sectionIds[sectionIds.length - 1],
    });

    updatedSections[sectionId] = result;
    const currentProgress = ParserService.reconstructMarkdown(
      frontmatter,
      updatedSections,
    );
    await IoService.writeFile(filePath, currentProgress);
  }
}

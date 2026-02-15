// packages/mobile/presets/executeMobileFillAction.ts
import { AskHandler } from "@/types/interactions";
import {
  AgentPair,
  ContentFrontmatter,
  FillAction,
  IoService,
  ParserService,
} from "@hub-spoke/core";

const TODO_REGEX = />\s*\*\*?TODO:?\*?\s*(.*)/i;

export async function executeMobileFillAction(
  agents: AgentPair[],
  frontmatter: ContentFrontmatter,
  sections: Record<string, string>,
  filePath: string,
  handlers: {
    ask: AskHandler;
    onStatus: (message: string) => void;
  },
): Promise<void> {
  const sectionIds = Object.keys(sections);
  const updatedSections = { ...sections };

  const pendingSectionIds = sectionIds.filter((id) =>
    TODO_REGEX.test(updatedSections[id]),
  );

  if (pendingSectionIds.length === 0) return;

  // Initialize the action once with the Persona ID from frontmatter
  const fillAction = new FillAction(frontmatter.personaId, agents)
    .onStart((id) => handlers.onStatus(`Generating: ${id}`))
    .onWrite((data) => handlers.ask("writer", data))
    .onRephrase((data) => handlers.ask("persona", data))
    .onRetry((err) => handlers.ask("retry", err));

  for (const sectionId of pendingSectionIds) {
    const blueprint = frontmatter.blueprint[sectionId];

    const result = await fillAction.execute({
      sectionId,
      sectionBody: updatedSections[sectionId],
      blueprint,
      topic: frontmatter.topic,
      goal: frontmatter.goal,
      audience: frontmatter.audience,
      isFirst: sectionId === sectionIds[0],
      isLast: sectionId === sectionIds[sectionIds.length - 1],
    });

    updatedSections[sectionId] = result;

    // Incrementally save progress using the injected data
    const currentProgress = ParserService.reconstructMarkdown(
      frontmatter,
      updatedSections,
    );
    await IoService.safeWriteFile(filePath, currentProgress);
  }
}

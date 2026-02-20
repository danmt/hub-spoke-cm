// packages/mobile/presets/executeMobileFillAction.tsx
import { AskHandler } from "@/types/interactions";
import {
  AgentPair,
  ContentFrontmatter,
  FillAction,
  IoService,
  ParserService,
} from "@hub-spoke/core";

const TODO_REGEX = />\s*\*\*?TODO:?\*?\s*(.*)/i;

/**
 * Orchestrates the section-filling process with granular status reporting.
 * Emits specific agent IDs and phases (writing/styling) to keep the UI informed.
 */
export async function executeMobileFillAction(
  workspaceRoot: string,
  agents: AgentPair[],
  frontmatter: ContentFrontmatter,
  sections: Record<string, string>,
  filePath: string,
  handlers: {
    ask: AskHandler;
    onStatus: (
      message: string,
      sectionId: string,
      agentId?: string,
      phase?: string,
    ) => void;
    onSectionComplete: (
      hubId: string,
      sectionId: string,
      hasRemainingTodos: boolean,
    ) => Promise<void>;
  },
): Promise<void> {
  const sectionIds = Object.keys(sections);
  const updatedSections = { ...sections };

  // Identify sections that actually need work
  const pendingSectionIds = sectionIds.filter((id) =>
    TODO_REGEX.test(updatedSections[id]),
  );

  if (pendingSectionIds.length === 0) return;

  // Initialize the FillAction orchestrator with the Persona defined in metadata
  const fillAction = new FillAction(
    workspaceRoot,
    frontmatter.personaId,
    agents,
  )
    .onStart((id) => {
      // Basic initialization status
      handlers.onStatus(`Initializing section: ${id}`, id);
    })
    .onWriting((data) => {
      // Phase 1: Neutral technical drafting
      handlers.onStatus(
        `Writing section ${data.id}...`,
        data.id,
        data.writerId,
        "writing",
      );
    })
    .onRephrasing((data) => {
      // Phase 2: Persona-specific voice application
      handlers.onStatus(
        `Styling section ${data.id}...`,
        data.id,
        data.personaId,
        "styling",
      );
    })
    .onWrite((data) => handlers.ask("writer", data))
    .onRephrase((data) => handlers.ask("persona", data))
    .onRetry((err) => handlers.ask("retry", err));

  // Sequentially process each pending section
  for (let i = 0; i < pendingSectionIds.length; i++) {
    const sectionId = pendingSectionIds[i];
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

    // Update local state and persist to filesystem incrementally
    updatedSections[sectionId] = result;

    const currentProgress = ParserService.reconstructMarkdown(
      frontmatter,
      updatedSections,
    );

    await IoService.safeWriteFile(filePath, currentProgress);

    const remaining = pendingSectionIds.slice(i + 1).length > 0;
    await handlers.onSectionComplete(frontmatter.hubId, sectionId, remaining);
  }
}

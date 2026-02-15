import { AskHandler } from "@/types/interactions";
import {
  AgentPair,
  ArchitectResponse,
  AssembleResponse,
  CreateHubAction,
  IoService,
  ParserService,
  PersonaResponse,
} from "@hub-spoke/core";

export interface ExecuteMobileCreateHubActionResult {
  architecture: ArchitectResponse;
  assembly: AssembleResponse;
  personification: PersonaResponse;
  filePath: string;
  fileContent: string;
}

/**
 * Orchestrates the Hub creation process for Mobile with full type safety.
 */
export async function executeMobileCreateHubAction(
  apiKey: string,
  model: string,
  manifest: string,
  baseline: { topic: string; goal: string; audience: string; language: string },
  agents: AgentPair[],
  workspaceRoot: string,
  handlers: {
    ask: AskHandler;
    onStatus: (message: string) => void;
  },
): Promise<ExecuteMobileCreateHubActionResult> {
  const action = new CreateHubAction(apiKey, model, manifest, baseline, agents)
    // 1. Architect Phase: Expects ArchitectInteractionResponse
    .onArchitecting(() => handlers.onStatus("Architect is planning..."))
    .onArchitect((data) => handlers.ask("architect", data))

    // 2. Assembler Phase: Expects AssemblerInteractionResponse
    .onAssembling((id) =>
      handlers.onStatus(`Assembler (${id}) is building structure...`),
    )
    .onAssembler((data) => handlers.ask("assembler", data))

    // 3. Personification Phase: Expects PersonaInteractionResponse
    .onRephrasing((id) => handlers.onStatus(`${id} is styling the intro...`))
    .onRephrase((data) => handlers.ask("persona", data))

    // 4. Global Retry Handler: Expects boolean (retry or not)
    .onRetry((err) => handlers.ask("retry", err));

  const result = await action.execute();

  const hubDir = await IoService.createHubDirectory(
    workspaceRoot,
    result.assembly.blueprint.hubId,
  );

  const filePath = `${hubDir}/hub.md`;

  const fileContent = ParserService.generateScaffold(
    result.architecture.brief,
    result.assembly.blueprint,
    result.personification.header,
    result.personification.content,
  );

  await IoService.safeWriteFile(filePath, fileContent);

  return {
    ...result,
    filePath,
    fileContent,
  };
}

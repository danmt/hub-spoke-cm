// packages/mobile/presets/executeMobileCreateHubAction.ts
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

export async function executeMobileCreateHubAction(
  apiKey: string,
  model: string,
  manifest: string,
  baseline: { topic: string; goal: string; audience: string; language: string },
  agents: AgentPair[],
  workspaceRoot: string,
  handlers: {
    ask: AskHandler;
    onStatus: (message: string, agentId?: string, phase?: string) => void;
    onComplete: (hubId: string, title: string) => Promise<void>;
  },
): Promise<ExecuteMobileCreateHubActionResult> {
  const action = new CreateHubAction(apiKey, model, manifest, baseline, agents)
    .onArchitecting(() =>
      handlers.onStatus("Architect is planning...", "Architect", "planning"),
    )
    .onArchitect((data) => handlers.ask("architect", data))
    .onAssembling((id) =>
      handlers.onStatus(`Building structure...`, id, "assembling"),
    )
    .onAssembler((data) => handlers.ask("assembler", data))
    .onRephrasing((id) => handlers.onStatus(`Styling intro...`, id, "styling"))
    .onRephrase((data) => handlers.ask("persona", data))
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

  await handlers.onComplete(
    result.assembly.blueprint.hubId,
    result.personification.header,
  );

  return { ...result, filePath, fileContent };
}

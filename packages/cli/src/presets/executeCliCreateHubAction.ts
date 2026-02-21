// packages/cli/src/presets/executeCliCreateHubAction.ts
import {
  AgentPair,
  ArchitectResponse,
  CompilerService,
  CreateHubAction,
  getAgent,
  HubService,
  IoService,
} from "@hub-spoke/core";
import chalk from "chalk";
import inquirer from "inquirer";
import path from "path";
import { confirmOrFeedback } from "../utils/confirmOrFeedback.js";
import { indentText } from "../utils/identText.js";
import { retryHandler } from "../utils/retryHandler.js";

export interface ExecuteCreateHubActionResult {
  architecture: ArchitectResponse;
  hubId: string;
  statePath: string;
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

  const action = new CreateHubAction(
    workspaceRoot,
    apiKey,
    model,
    manifest,
    baseline,
    agents,
  )
    .onArchitecting(() =>
      console.log(chalk.blue("\n🧠 Architect is refining the brief...")),
    )
    .onArchitect(({ message, brief }) => {
      console.log(`\n${chalk.green("Architect:")} ${message}`);
      console.log(chalk.dim(`\n--- Current Proposal ---`));
      console.log(`${chalk.yellow("Topic:")}    ${brief.topic}`);
      console.log(
        `${chalk.yellow("Persona:")}  ${getAgent(agents, "persona", brief.personaId)?.artifact.displayName ?? brief.personaId}`,
      );
      console.log(
        `${chalk.yellow("Outliner:")} ${getAgent(agents, "assembler", brief.assemblerId)?.artifact.displayName ?? brief.assemblerId}`,
      );
      return confirmOrFeedback();
    })
    .onAssemblingOutline((id) => {
      const agent = getAgent(agents, "assembler", id);
      console.log(
        chalk.cyan(
          `\n🏗️  ${chalk.bold(agent?.artifact.displayName ?? id)} is architecting the macro-outline...`,
        ),
      );
    })
    .onAssembleOutline(async (params) => {
      console.log(chalk.bold.cyan("\n📋 Proposed Document Sections:"));
      params.sections.forEach((s, i) => {
        console.log(
          `${chalk.white(`${i + 1}.`)} ${"#".repeat(s.level)} ${s.header}`,
        );
        console.log(
          indentText(`${chalk.dim("Delegated to:")} ${s.assemblerId}`, 4),
        );
      });
      return { action: "skip" };
    })
    .onAssemblingBlocks((_, header) => {
      console.log(
        chalk.dim(`   └─ Delegating blocks for: ${chalk.white(header)}...`),
      );
    })
    .onAssembleBlocks(async (params) => {
      params.blocks.forEach((b) => {
        console.log(
          chalk.dim(
            `      ├─ Block: ${chalk.blue(b.id)} (Writer: ${b.writerId})`,
          ),
        );
      });

      return { action: "skip" };
    })
    .onWriting((data) => {
      console.log(chalk.magenta(`\n🖋️  Drafting Hub Identity (${data.id})...`));
    })
    .onWrite(async ({ content }) => {
      console.log(indentText(chalk.italic(`"${content}"\n`), 4));
      return { action: "skip" };
    })
    .onRephrasing(() => {
      console.log(chalk.magenta(`✨ Styling Hub Identity with persona...`));
    })
    .onRephrase(async ({ content }) => {
      console.log(indentText(chalk.italic(`"${content}"\n`), 4));
      return { action: "skip" };
    })
    .onRetry(retryHandler);

  // 1. Execute the multi-pass AI logic
  const result = await action.execute();

  // 2. Prepare the Hub Directory (creates /posts/<id>/blocks/)
  const hubDir = await HubService.createHubDirectory(
    workspaceRoot,
    result.architecture.brief.hubId,
  );

  // 3. Generate the hub.json State Machine (The AST)
  const initialState = CompilerService.generateInitialState(
    result.architecture.brief,
    result.sections,
    result.personification.title,
    result.personification.description,
  );

  const statePath = IoService.join(hubDir, "hub.json");
  await IoService.writeFile(statePath, JSON.stringify(initialState, null, 2));

  // 4. Initial Compilation (Creates compiled.md with TODOs)
  await CompilerService.compile(hubDir);

  console.log(
    chalk.bold.green(
      `\n✅ Hub State Machine initialized at: ${chalk.white(path.relative(workspaceRoot, statePath))}\n`,
    ),
  );

  return {
    architecture: result.architecture,
    hubId: initialState.hubId,
    statePath,
  };
}

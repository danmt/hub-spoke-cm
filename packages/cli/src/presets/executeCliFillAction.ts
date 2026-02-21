// packages/cli/src/presets/executeCliFillAction.ts
import {
  AgentPair,
  CompilerService,
  FillAction,
  HubService,
  IoService,
  getAgent,
} from "@hub-spoke/core";
import chalk from "chalk";
import { indentText } from "../utils/identText.js";
import { retryHandler } from "../utils/retryHandler.js";

export async function executeCliFillAction(
  workspaceRoot: string,
  agents: AgentPair[],
  hubRootDir: string,
): Promise<void> {
  // 1. Load the Hub State (The AST)
  const state = await HubService.readHub(hubRootDir);

  const fillAction = new FillAction(workspaceRoot, state.personaId, agents)
    .onWriting((data) => {
      const agent = getAgent(agents, "writer", data.writerId);
      console.log(
        chalk.cyan(
          `\n🖋️  [${chalk.bold(agent?.artifact.displayName ?? data.writerId)}] Drafting: ${chalk.white(data.id)}...`,
        ),
      );
    })
    .onWrite(async ({ content }) => {
      console.log(chalk.dim(indentText(content.substring(0, 150) + "...", 4)));
      return { action: "skip" };
    })
    .onRephrasing((data) => {
      console.log(
        chalk.magenta(
          `   ✨ Applying persona styling to ${chalk.bold(data.id)}...`,
        ),
      );
    })
    .onRephrase(async ({ content }) => {
      console.log(
        indentText(chalk.italic(`"${content.substring(0, 100)}..."`), 6),
      );
      return { action: "skip" };
    })
    .onRetry(retryHandler);

  // 2. Multi-Pass Execution: Iterate Sections
  for (const section of state.sections) {
    console.log(
      chalk.yellow(`\n📂 Processing Section: ${chalk.bold(section.header)}`),
    );

    // --- PASS 1: OPTIMIZE HEADER ---
    if (!section.title || section.status === "pending") {
      console.log(chalk.magenta(`   ✨ Optimizing section title...`));

      const styledHeader = await fillAction.execute({
        targetId: `header-${section.id}`,
        writerId: section.writerId,
        intent: `Create a short, technical, and compelling section header based on the draft: "${section.header}".`,
        section,
        topic: state.topic,
        goal: state.goal,
        audience: state.audience,
        isFirst: section.id === state.sections[0].id,
        isLast: section.id === state.sections[state.sections.length - 1].id,
      });

      // Update state and save immediately to keep hub.json synced
      section.title = styledHeader;
      await IoService.writeFile(
        IoService.join(hubRootDir, "hub.json"),
        JSON.stringify(state, null, 2),
      );

      // Re-compile so compiled.md shows the new header immediately
      await CompilerService.compile(hubRootDir);
      console.log(chalk.green(`   ✅ Header finalized: "${styledHeader}"`));
    }

    // --- PASS 2: FILL BLOCKS ---
    for (const block of section.blocks) {
      if (block.status === "completed") {
        console.log(chalk.gray(`   skipping completed block: ${block.id}`));
        continue;
      }

      const result = await fillAction.execute({
        targetId: block.id,
        intent: block.intent,
        writerId: block.writerId,
        section,
        topic: state.topic,
        goal: state.goal,
        audience: state.audience,
        isFirst: false,
        isLast: false,
      });

      // Save Atomic Block file
      const blockPath = IoService.join(
        hubRootDir,
        "blocks",
        `${section.id}-${block.id}.md`,
      );
      await IoService.writeFile(blockPath, result);

      // Update AST State and sync to disk
      block.status = "completed";
      await IoService.writeFile(
        IoService.join(hubRootDir, "hub.json"),
        JSON.stringify(state, null, 2),
      );

      // Refresh compiled.md so the user can watch progress
      await CompilerService.compile(hubRootDir);
      console.log(chalk.green(`   ✅ Block ${block.id} finalized.`));
    }

    // Mark the entire section as completed
    section.status = "completed";
    await IoService.writeFile(
      IoService.join(hubRootDir, "hub.json"),
      JSON.stringify(state, null, 2),
    );
  }

  console.log(
    chalk.bold.green("\n✨ All pending headers and blocks finalized."),
  );
}

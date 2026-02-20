import {
  AgentService,
  ConfigService,
  EvolutionEngine,
  IntelligenceService,
  RegistryService,
  SecretService,
  WorkspaceService,
} from "@hub-spoke/core";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";

export const agentCommand = new Command("agent").description(
  "Manage the AI workforce",
);

// Subcommand: hub agent create
agentCommand
  .command("create")
  .description("Interactively create a new Agent package")
  .action(async () => {
    try {
      const workspaceRoot = await WorkspaceService.findRoot(process.cwd());
      const secret = await SecretService.getSecret();
      const config = await ConfigService.getConfig();

      if (!secret.apiKey)
        throw new Error("API Key required. Run 'hub config set-key'.");

      const { type } = await inquirer.prompt([
        {
          type: "list",
          name: "type",
          message: "Agent Type:",
          choices: ["persona", "writer", "assembler"],
        },
      ]);

      const identity = await inquirer.prompt([
        { type: "input", name: "displayName", message: "Display Name:" },
        {
          type: "input",
          name: "tone",
          message: "Tone:",
          when: type === "persona",
          default: "Professional and concise",
        },
        {
          type: "input",
          name: "language",
          message: "Language:",
          when: type === "persona",
          default: "English",
        },
        {
          type: "input",
          name: "accent",
          message: "Accent:",
          when: type === "persona",
          default: "Neutral",
        },
        {
          type: "editor",
          name: "behavior",
          message: "Enter core Behavior instructions:",
        },
      ]);

      console.log(
        chalk.blue(
          "\n🧠 Analyzing behavior to generate registry description...",
        ),
      );

      const agentId = crypto.randomUUID();
      const description = await IntelligenceService.generateInferredDescription(
        secret.apiKey,
        config.model || "gemini-2.0-flash",
        identity.displayName,
        identity.behavior,
      );

      await AgentService.saveAgent(workspaceRoot, {
        identity: {
          id: agentId,
          type,
          displayName: identity.displayName,
          metadata:
            type === "persona"
              ? {
                  tone: identity.tone,
                  language: identity.language,
                  accent: identity.accent,
                }
              : {},
        },
        behavior: identity.behavior,
        knowledge: { description, truths: [] },
      });

      console.log(
        chalk.green(
          `\n✅ Agent "${identity.displayName}" created successfully!`,
        ),
      );
      console.log(chalk.gray(`Path: agents/${type}s/${agentId}`));
    } catch (error: any) {
      console.error(chalk.red("\n❌ Agent Creation Failed:"), error.message);
    }
  });

// Subcommand: hub agent upgrade
agentCommand
  .command("upgrade")
  .description("Trigger the Evolution Engine to learn from user feedback")
  .argument("[agentId]", "Specific Agent ID to upgrade (optional)")
  .option("-a, --all", "Upgrade all agents with pending feedback")
  .action(async (agentId, options) => {
    try {
      const workspaceRoot = await WorkspaceService.findRoot(process.cwd());
      const secret = await SecretService.getSecret();
      const config = await ConfigService.getConfig();

      if (!secret.apiKey) {
        throw new Error("Gemini API Key not found. Run 'hub config set-key'.");
      }

      const artifacts = await RegistryService.getAllArtifacts(workspaceRoot);
      let targets = artifacts;

      // Interactive selection if no ID and no --all flag
      if (!agentId && !options.all) {
        if (artifacts.length === 0) {
          console.log(
            chalk.yellow("\n⚠️  No agents found in registry to upgrade."),
          );
          return;
        }

        const { selectedId } = await inquirer.prompt([
          {
            type: "list",
            name: "selectedId",
            message: "Select an Agent to evolve:",
            choices: artifacts.map((a) => ({
              name: `${a.displayName} (${a.type}) - ${a.id}`,
              value: a.id,
            })),
          },
        ]);
        targets = artifacts.filter((a) => a.id === selectedId);
      } else if (agentId) {
        targets = artifacts.filter((a) => a.id === agentId);
        if (targets.length === 0) {
          console.log(chalk.red(`\n❌ Agent "${agentId}" not found.`));
          return;
        }
      }

      console.log(chalk.blue(`\n🧠 Evolution Engine Initialized\n`));

      for (const target of targets) {
        try {
          console.log(
            chalk.cyan(
              `🔄 Processing: ${chalk.bold(target.displayName)} (${target.id})...`,
            ),
          );

          const result = await EvolutionEngine.evolve(
            workspaceRoot,
            secret.apiKey,
            config.model || "gemini-2.0-flash",
            target.type,
            target.id,
          );

          console.log(chalk.green(`   ✅ Evolution Successful`));
          console.log(chalk.dim(`   💭 Thought: ${result.thoughtProcess}`));

          if (result.addedTruths.length > 0) {
            result.addedTruths.forEach((t) =>
              console.log(chalk.green(`      + [NEW] ${t}`)),
            );
          }
          if (result.strengthenedTruths.length > 0) {
            result.strengthenedTruths.forEach((t) =>
              console.log(chalk.blue(`      ↑ [REINFORCED] ${t}`)),
            );
          }
          if (result.weakenedTruths.length > 0) {
            result.weakenedTruths.forEach((t) =>
              console.log(chalk.yellow(`      ↓ [WEAKENED] ${t}`)),
            );
          }
          console.log("");
        } catch (err: any) {
          if (options.all) {
            console.log(
              chalk.dim(`   ⏩ Skipped ${target.id}: ${err.message}\n`),
            );
          } else {
            throw err;
          }
        }
      }
      console.log(chalk.bold.green("✨ Workforce synchronization complete."));
    } catch (error: any) {
      console.error(chalk.red("\n❌ Upgrade Failed:"), error.message);
      process.exit(1);
    }
  });

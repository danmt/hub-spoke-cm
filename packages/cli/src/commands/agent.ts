import {
  AgentService,
  ConfigService,
  EvolutionEngine,
  EvolutionService,
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

      if (!config.model) {
        throw new Error("Model not found. Run 'hub config set-model'.");
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

          // --- PHASE 4: CONFLICT ORCHESTRATION ---
          if (result.conflictType === "hard") {
            console.log(chalk.red.bold(`\n⚠️  Hard Conflict Detected!`));

            // Explain why the conflict happened
            if (result.violatedMetadataField) {
              console.log(
                chalk.red(
                  `   Inconsistency: Feedback contradicts ${chalk.bold(result.violatedMetadataField)}.`,
                ),
              );
              console.log(
                chalk.yellow(
                  `   Inferred correction: ${chalk.green(result.newMetadataValue)}`,
                ),
              );
            } else if (result.violatedTruth) {
              console.log(
                chalk.red(
                  `   Contradiction: Feedback negates truth: "${chalk.italic(result.violatedTruth)}".`,
                ),
              );
            }

            console.log(chalk.dim(`   AI Reasoning: ${result.thoughtProcess}`));

            const { action } = await inquirer.prompt([
              {
                type: "list",
                name: "action",
                message:
                  "A specialized fork is recommended. How do you want to proceed?",
                choices: [
                  { name: "🔱 Fork into new specialized agent", value: "fork" },
                  {
                    name: "📝 Force Update original (pivots core identity)",
                    value: "overwrite",
                  },
                  { name: "⏩ Skip this agent", value: "skip" },
                ],
              },
            ]);

            if (action === "skip") {
              console.log(
                chalk.gray(`   ⏩ Evolution deferred for ${target.id}.\n`),
              );
              continue;
            }

            if (action === "fork") {
              // Only prompt for Display Name as requested
              const { newDisplayName } = await inquirer.prompt([
                {
                  type: "input",
                  name: "newDisplayName",
                  message: "Enter Display Name for the new agent:",
                  default:
                    result.suggestedForkName ||
                    `${target.displayName} (Specialized)`,
                  validate: (v) => v.trim().length > 0 || "Name is required.",
                },
              ]);

              const newId = crypto.randomUUID();

              await AgentService.forkAgent(
                secret.apiKey,
                config.model,
                workspaceRoot,
                target.id,
                newId,
                target.type,
                newDisplayName,
                result.analysis, // Passes metadata/truth corrections to the fork
              );

              // Clear original buffer as the feedback has been specialized into the fork
              await AgentService.clearFeedbackBuffer(
                workspaceRoot,
                target.type,
                target.id,
              );

              console.log(
                chalk.green(
                  `   ✅ Specialized agent created: ${chalk.bold(newDisplayName)} (${newId})\n`,
                ),
              );
              continue;
            }

            if (action === "overwrite") {
              // Force the update on the original agent regardless of contradiction
              const updatedTruths = EvolutionService.applyProposals(
                target.truths,
                result.analysis.proposals,
              );

              await AgentService.saveAgent(workspaceRoot, {
                identity: {
                  ...target,
                  metadata:
                    result.violatedMetadataField &&
                    result.newMetadataValue &&
                    target.type === "persona"
                      ? {
                          ...target.metadata,
                          [result.violatedMetadataField]:
                            result.newMetadataValue,
                        }
                      : target.type === "persona"
                        ? target.metadata
                        : {},
                },
                behavior: target.content,
                knowledge: {
                  description: result.newDescription,
                  truths: updatedTruths,
                },
              });

              await AgentService.clearFeedbackBuffer(
                workspaceRoot,
                target.type,
                target.id,
              );
              console.log(
                chalk.yellow(`   ✅ Original agent updated with override.\n`),
              );
              continue;
            }
          }

          // --- STANDARD SOFT EVOLUTION (Phase 3 Path) ---
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

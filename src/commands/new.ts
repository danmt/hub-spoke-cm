// src/cli/commands/new.ts
import { GoogleGenAI } from "@google/genai";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { ArchitectAgent } from "../agents/Architect.js";
import { FillService } from "../services/FillService.js";
import { IoService } from "../services/IoService.js";
import { RegistryService } from "../services/RegistryService.js";
import { ValidationService } from "../services/ValidationService.js"; // Added for direct audit access
import { getGlobalConfig } from "../utils/config.js";

export const newCommand = new Command("new")
  .description("Create a new Hub inside the workspace /posts directory")
  .action(async () => {
    const workspaceRoot = await IoService.findWorkspaceRoot(process.cwd());
    const config = getGlobalConfig();
    console.log(chalk.gray(`\n📂 Active Workspace: ${workspaceRoot}`));

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

    const rawArtifacts = await RegistryService.getAllArtifacts();
    const client = new GoogleGenAI({ apiKey: config.apiKey! });
    const agents = RegistryService.initializeAgents(
      config,
      client,
      rawArtifacts,
    );
    const manifest = RegistryService.toManifest(agents);

    const architect = new ArchitectAgent(client, manifest, baseline);
    console.log(chalk.blue("\n🧠 Architect is analyzing project scope..."));

    let currentInput =
      "Analyze the baseline and ask me follow-up questions if needed.";
    let isComplete = false;

    while (!isComplete) {
      try {
        const response = await architect.chatWithUser(currentInput);

        if (response.gapFound) {
          console.log(`\n${chalk.red("Architect [GAP]:")} ${response.message}`);
          return;
        }

        console.log(`\n${chalk.green("Architect:")} ${response.message}`);

        if (response.isComplete && response.brief) {
          const brief = response.brief;

          console.log(
            chalk.cyan(
              `\n🏗️  Requesting structure from ${chalk.bold(brief.assemblerId)}...`,
            ),
          );
          const assemblers = RegistryService.getAgentsByType(
            agents,
            "assembler",
          );
          const assembler = assemblers.find(
            (a) => a.artifact.id === brief.assemblerId,
          );

          if (!assembler) {
            throw new Error(
              `Assembler "${brief.assemblerId}" not found in workspace. ` +
                `Available: ${assemblers.map((a) => a.artifact.id).join(", ")}`,
            );
          }

          const blueprint = await assembler.agent.generateSkeleton(brief);

          console.log(chalk.bold.cyan("\n📋 Intelligent Blueprint Summary:"));
          blueprint.components.forEach((c, i) => {
            const typeLabel = c.writerId === "code" ? "💻 CODE" : "📝 PROSE";
            console.log(
              chalk.white(`${i + 1}. [${typeLabel}] `) + chalk.bold(c.header),
            );
            console.log(chalk.dim(`   Instruction: ${c.intent}\n`));
          });

          const { confirmed } = await inquirer.prompt([
            {
              type: "confirm",
              name: "confirmed",
              message: "Does this structure look good?",
              default: true,
            },
          ]);

          if (!confirmed) {
            currentInput =
              "I don't like this structure. Can we try a different approach?";
            continue;
          }

          const hubDir = await IoService.createHubDirectory(blueprint.hubId);
          const blueprintData: Record<string, any> = {};
          const writerMap: Record<string, string> = {};

          blueprint.components.forEach((c) => {
            blueprintData[c.header] = {
              intent: c.intent,
              writerId: c.writerId,
            };
            writerMap[c.header] = c.writerId;
          });

          const fileContent = [
            "---",
            `title: ${JSON.stringify(brief.topic)}`,
            'type: "hub"',
            `hubId: ${JSON.stringify(blueprint.hubId)}`,
            `goal: ${JSON.stringify(brief.goal)}`,
            `audience: ${JSON.stringify(brief.audience)}`,
            `language: ${JSON.stringify(brief.language)}`,
            `date: ${JSON.stringify(new Date().toISOString().split("T")[0])}`,
            `assemblerId: ${JSON.stringify(brief.assemblerId)}`,
            `personaId: ${JSON.stringify(brief.personaId)}`,
            `blueprint: ${JSON.stringify(blueprintData)}`,
            `writerMap: ${JSON.stringify(writerMap)}`,
            `bridges: {}`,
            "---",
            "",
            `# ${brief.topic}`,
            "",
            ...blueprint.components.map(
              (c) =>
                `## ${c.header}\n\n> **TODO:** ${c.intent}\n\n*Pending generation...*\n`,
            ),
          ].join("\n");

          const filePath = path.join(hubDir, "hub.md");
          await IoService.safeWriteFile(filePath, fileContent);
          console.log(
            chalk.bold.green(`\n✅ Hub scaffolded at posts/${blueprint.hubId}`),
          );

          const { shouldFill } = await inquirer.prompt([
            {
              type: "confirm",
              name: "shouldFill",
              message: "Generate content now?",
              default: true,
            },
          ]);

          if (shouldFill) {
            await FillService.execute(config, client, filePath, true);
            console.log(chalk.bold.cyan("\n🚀 Hub populated successfully!"));

            const { shouldAudit } = await inquirer.prompt([
              {
                type: "confirm",
                name: "shouldAudit",
                message: "Run a semantic audit on the new content?",
                default: true,
              },
            ]);

            if (shouldAudit) {
              const auditors = RegistryService.getAgentsByType(
                agents,
                "auditor",
              );
              if (auditors.length > 0) {
                const { auditorId } = await inquirer.prompt([
                  {
                    type: "list",
                    name: "auditorId",
                    message: "Select Auditor Strategy:",
                    choices: auditors.map((a) => ({
                      name: `${a.artifact.id}: ${a.artifact.description}`,
                      value: a.artifact.id,
                    })),
                  },
                ]);

                const selectedAuditor = auditors.find(
                  (a) => a.artifact.id === auditorId,
                )!;
                console.log(
                  chalk.cyan(
                    `\n🧠 Running Step 2: Semantic Analysis [${auditorId}]...`,
                  ),
                );

                const report = await ValidationService.runAudit(
                  config,
                  client,
                  filePath,
                  selectedAuditor.agent,
                );

                if (report.issues.length === 0) {
                  console.log(
                    chalk.bold.green("\n✨ Audit passed! No issues found."),
                  );
                } else {
                  console.log(
                    chalk.yellow(
                      `\n⚠️  Auditor found ${report.issues.length} potential improvements.`,
                    ),
                  );
                  console.log(
                    chalk.gray(
                      "Run 'hub audit' manually to apply verified fixes.",
                    ),
                  );
                }
              } else {
                console.log(
                  chalk.dim(
                    "\n(No auditors found in registry; skipping audit step)",
                  ),
                );
              }
            }
          }

          isComplete = true;
        } else {
          const { next } = await inquirer.prompt([
            {
              type: "input",
              name: "next",
              message: chalk.cyan("You:"),
              validate: (val) => !!val || "Please provide a response.",
            },
          ]);
          currentInput = next;
        }
      } catch (error) {
        console.error(
          chalk.red("\n❌ Error during Architecture/Assembly:"),
          error instanceof Error ? error.message : String(error),
        );
        const { retry } = await inquirer.prompt([
          {
            type: "confirm",
            name: "retry",
            message: "Would you like to retry the last operation?",
            default: true,
          },
        ]);

        if (!retry) {
          console.log(chalk.gray("Aborting."));
          process.exit(1);
        }
      }
    }
  });

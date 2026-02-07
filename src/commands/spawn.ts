// src/cli/commands/spawn.ts
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { Architect } from "../agents/Architect.js";
import { FillService } from "../services/FillService.js";
import { IoService } from "../services/IoService.js";
import { ParserService } from "../services/ParserService.js";
import { RegistryService } from "../services/RegistryService.js";
import { ValidationService } from "../services/ValidationService.js";

export const spawnCommand = new Command("spawn")
  .description("Create a new Spoke article by expanding a Hub section")
  .action(async () => {
    try {
      const workspaceRoot = await IoService.findWorkspaceRoot(process.cwd());
      const rawArtifacts = await RegistryService.getAllArtifacts();
      const agents = RegistryService.initializeAgents(rawArtifacts);

      try {
        RegistryService.validateIntegrity(agents);
      } catch (error) {
        console.error(chalk.red("\n❌ Registry Integrity Check Failed:"));
        console.error(chalk.yellow((error as Error).message));
        process.exit(1);
      }

      const hubs = await IoService.findAllHubsInWorkspace(workspaceRoot);
      if (hubs.length === 0) throw new Error("No hubs found.");

      const { targetHub } = await inquirer.prompt([
        {
          type: "list",
          name: "targetHub",
          message: "Select parent Hub:",
          choices: hubs,
        },
      ]);
      const rootDir = path.join(workspaceRoot, "posts", targetHub);
      const hubMeta = await IoService.readHubMetadata(rootDir);
      const hubRaw = await IoService.readHubFile(rootDir);
      const parsedHub = ParserService.parseMarkdown(hubRaw);

      const sections = Object.keys(parsedHub.sections);
      const { targetSection } = await inquirer.prompt([
        {
          type: "list",
          name: "targetSection",
          message: "Select Hub section to expand:",
          choices: sections,
        },
      ]);

      const architect = new Architect(RegistryService.toManifest(agents), {
        topic: targetSection,
        language: hubMeta.language,
        audience: hubMeta.audience,
        goal: `Expand on '${targetSection}' from the ${hubMeta.title} hub.`,
        personaId: hubMeta.personaId,
      });

      let currentInput = `Plan a Spoke for "${targetSection}".`;
      let isComplete = false;

      while (!isComplete) {
        try {
          const response = await architect.chatWithUser({
            input: currentInput,
          });
          if (response.gapFound)
            return console.log(chalk.red("\n[GAP]: ") + response.message);
          console.log(`\n${chalk.green("Architect:")} ${response.message}`);

          if (response.isComplete && response.brief) {
            const brief = response.brief;
            const assemblers = RegistryService.getAgentsByType(
              agents,
              "assembler",
            );
            const assembler = assemblers.find(
              (a) => a.artifact.id === brief.assemblerId,
            );

            if (!assembler) {
              throw new Error(
                `Assembler "${brief.assemblerId}" not found in /agents/assemblers. ` +
                  `Available: ${assemblers.map((a) => a.artifact.id).join(", ")}`,
              );
            }

            const { blueprint } = await assembler.agent.generateSkeleton({
              brief,
            });
            const blueprintData: Record<string, any> = {};
            const writerMap: Record<string, string> = {};

            blueprint.components.forEach((c) => {
              blueprintData[c.header] = {
                intent: c.intent,
                writerId: c.writerId,
              };
              writerMap[c.header] = c.writerId;
            });

            console.log(
              chalk.cyan(
                `\n🏗️  Spoke Structure Generated (${blueprint.components.length} sections)`,
              ),
            );

            const fileName = `${blueprint.hubId}.md`;
            const filePath = path.join(rootDir, "spokes", fileName);

            const fileContent = [
              "---",
              `title: ${JSON.stringify(targetSection)}`,
              'type: "spoke"',
              `hubId: ${JSON.stringify(hubMeta.hubId)}`,
              `componentId: ${JSON.stringify(blueprint.hubId)}`,
              `goal: ${JSON.stringify(brief.goal)}`,
              `audience: ${JSON.stringify(hubMeta.audience)}`,
              `language: ${JSON.stringify(hubMeta.language)}`,
              `date: ${JSON.stringify(new Date().toISOString().split("T")[0])}`,
              `personaId: ${JSON.stringify(hubMeta.personaId)}`,
              `blueprint: ${JSON.stringify(blueprintData)}`,
              `writerMap: ${JSON.stringify(writerMap)}`,
              "---",
              "",
              `# ${targetSection}`,
              "",
              ...blueprint.components.map(
                (c) =>
                  `## ${c.header}\n\n> **TODO:** ${c.intent}\n\n*Pending generation...*\n`,
              ),
            ].join("\n");

            await IoService.safeWriteFile(filePath, fileContent);
            console.log(
              chalk.bold.green(`\n✅ Spoke created: spokes/${fileName}`),
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
              await FillService.execute(filePath, true);
              console.log(
                chalk.cyan("\n🚀 Spoke populated. Running stepped audit..."),
              );

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

                  const { allIssues } = await ValidationService.runFullAudit(
                    filePath,
                    selectedAuditor.agent,
                  );

                  if (allIssues.length === 0) {
                    console.log(
                      chalk.bold.green("\n✨ Audit passed! No issues found."),
                    );
                  } else {
                    console.log(
                      chalk.yellow(
                        `\n⚠️  Auditor found ${allIssues.length} issues. Run 'hub audit' to fix.`,
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
                validate: (v) => !!v,
              },
            ]);
            currentInput = next;
          }
        } catch (error) {
          console.error(chalk.red("\n❌ Architect/Assembler Error:"), error);
          const { retry } = await inquirer.prompt([
            {
              type: "confirm",
              name: "retry",
              message: "Operation failed. Retry last step?",
              default: true,
            },
          ]);
          if (!retry) return;
        }
      }
    } catch (error) {
      console.error(chalk.red("\n❌ Spawn Error:"), error);
    }
  });

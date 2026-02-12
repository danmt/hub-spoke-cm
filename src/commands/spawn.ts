// src/commands/spawn.ts
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { Architect } from "../agents/Architect.js";
import { ContextService } from "../services/ContextService.js";
import { FillService } from "../services/FillService.js";
import { IoService } from "../services/IoService.js";
import { ParserService } from "../services/ParserService.js";
import { RegistryService } from "../services/RegistryService.js";
import { ValidationService } from "../services/ValidationService.js";
import { cliConfirmOrFeedback } from "../utils/cliConfirmOrFeedback.js";
import { cliRetryHandler } from "../utils/cliRetryHandler.js";
import { indentText } from "../utils/identText.js";

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

      const assemblers = RegistryService.getAgentsByType(agents, "assembler");
      const personas = RegistryService.getAgentsByType(agents, "persona");
      const writers = RegistryService.getAgentsByType(agents, "writer");
      const auditors = RegistryService.getAgentsByType(agents, "auditor");

      const manifest = RegistryService.toManifest(agents);

      const { rootDir } = await ContextService.resolveHubContext(
        workspaceRoot,
        async (hubs) => {
          const { targetHub } = await inquirer.prompt([
            {
              type: "list",
              name: "targetHub",
              message: "Select Hub:",
              choices: hubs,
            },
          ]);
          return targetHub;
        },
      );
      const hubMeta = await IoService.readHubMetadata(rootDir);
      const hubRaw = await IoService.readHubFile(rootDir);
      const parsedHub = ParserService.parseMarkdown(hubRaw);

      const sections = Object.keys(parsedHub.sections);
      const { section } = await inquirer.prompt([
        {
          type: "list",
          name: "section",
          message: "Select Hub section to expand:",
          choices: sections,
        },
      ]);

      const architect = new Architect(manifest, {
        topic: section,
        language: hubMeta.language,
        audience: hubMeta.audience,
        goal: `Expand on '${section}' from the ${hubMeta.title} hub.`,
        personaId: hubMeta.personaId,
      });

      const architecture = await architect.architect({
        input: `Plan a Spoke for "${section}".`,
        interact: async ({ message, brief }) => {
          console.log(`\n${chalk.green("Architect:")} ${message}`);
          console.log(chalk.dim(`\n--- Current Proposal ---`));
          console.log(`${chalk.yellow("Topic:")} ${brief.topic}`);
          console.log(`${chalk.yellow("Goal:")} ${brief.goal}`);
          console.log(`${chalk.yellow("Audience:")} ${brief.audience}`);
          console.log(`${chalk.yellow("Assembler:")} ${brief.assemblerId}`);
          console.log(`${chalk.yellow("Persona:")}   ${brief.personaId}\n`);

          return cliConfirmOrFeedback();
        },
        onRetry: cliRetryHandler,
        onThinking: () =>
          console.log(chalk.blue("\n🧠 Architect is thinking...")),
      });

      const assembler = assemblers.find(
        (a) => a.artifact.id === architecture.brief.assemblerId,
      );

      if (!assembler) {
        throw new Error(
          `Assembler "${architecture.brief.assemblerId}" not found in /agents/assemblers. ` +
            `Available: ${assemblers.map((a) => a.artifact.id).join(", ")}`,
        );
      }

      const { blueprint } = await assembler.agent.assemble({
        audience: architecture.brief.audience,
        goal: architecture.brief.goal,
        topic: architecture.brief.topic,
        interact: async ({ blueprint }) => {
          console.log(chalk.bold.cyan("\n📋 Intelligent Blueprint Summary:"));
          console.log(chalk.white(`\nTITLE: ${architecture.brief.topic}`));
          console.log(chalk.white(`HUB ID: ${blueprint.hubId}\n`));

          blueprint.components.forEach((c, i) => {
            console.log(
              chalk.white(`#${i + 1} [${c.writerId.toUpperCase()}] `) +
                chalk.bold(c.header),
            );
            console.log(chalk.gray(indentText(`INTENT: ${c.intent}`, 5)));
            console.log(chalk.gray(indentText(`BRIDGE: ${c.bridge}`, 5)));
          });

          return cliConfirmOrFeedback();
        },
      });

      console.log(
        chalk.cyan(
          `\n🏗️  Spoke Structure Generated (${blueprint.components.length} sections)`,
        ),
      );

      const fileContent = ParserService.generateScaffold(
        "spoke",
        architecture.brief,
        blueprint,
        hubMeta.hubId,
      );
      const filePath = path.join(rootDir, "spokes", `${blueprint.hubId}.md`);
      await IoService.safeWriteFile(filePath, fileContent);

      console.log(chalk.bold.green(`\n✅ Spoke created: spokes/${filePath}`));

      const { shouldFill } = await inquirer.prompt([
        {
          type: "confirm",
          name: "shouldFill",
          message: "Generate content now?",
          default: true,
        },
      ]);

      if (!shouldFill) return;

      const persona = personas.find(
        (p) => p.artifact.id === architecture.brief.personaId,
      );

      if (!persona) {
        throw new Error(
          `Persona "${architecture.brief.personaId}" not found in workspace. ` +
            `Available: ${personas.map((a) => a.artifact.id).join(", ")}`,
        );
      }

      await FillService.execute(
        filePath,
        blueprint.components.map((c) => c.id),
        persona,
        writers,
        ({ id, writerId }) =>
          console.log(
            chalk.gray(`   🔧  Generating section [${writerId}]: "${id}"...`),
          ),
        () => console.log(chalk.green("      Done ✅")),
        cliRetryHandler,
      );

      console.log(chalk.cyan("\n🚀 Spoke populated."));

      const { shouldAudit } = await inquirer.prompt([
        {
          type: "confirm",
          name: "shouldAudit",
          message: "Run a semantic audit on the new content?",
          default: true,
        },
      ]);

      if (!shouldAudit) return;

      if (auditors.length === 0) {
        throw new Error("No auditors found in workspace. ");
      }

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
        chalk.cyan(`\n🧠 Running Step 2: Semantic Analysis [${auditorId}]...`),
      );

      const { allIssues } = await ValidationService.runFullAudit(
        filePath,
        selectedAuditor.agent,
        persona,
        (header) => console.log(chalk.gray(`   🔎  Auditing "${header}"... `)),
        () => console.log(chalk.green("      Done ✅")),
        cliRetryHandler,
      );

      if (allIssues.length === 0) {
        console.log(chalk.bold.green("\n✨ Audit passed! No issues found."));
      } else {
        console.log(
          chalk.yellow(
            `\n⚠️  Auditor found ${allIssues.length} issues. Run 'hub audit' to fix.`,
          ),
        );
        console.log(
          chalk.gray("Run 'hub audit' manually to apply verified fixes."),
        );
      }
    } catch (error) {
      console.error(chalk.red("\n❌ Command `spawn` Error:"), error);
    }
  });

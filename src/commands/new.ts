// src/commands/new.ts
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
import { cliRetryHandler } from "../utils/cliRetryHandler.js";

export const newCommand = new Command("new")
  .description("Create a new Hub inside the workspace /posts directory")
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

      const auditors = RegistryService.getAgentsByType(agents, "auditor");
      const personas = RegistryService.getAgentsByType(agents, "persona");
      const writers = RegistryService.getAgentsByType(agents, "writer");
      const assemblers = RegistryService.getAgentsByType(agents, "assembler");
      const manifest = RegistryService.toManifest(agents);

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

      const architect = new Architect(manifest, baseline);

      const brief = await architect.architect({
        interact: async ({ message, brief }) => {
          console.log(`\n${chalk.green("Architect:")} ${message}`);
          console.log(chalk.dim(`\n--- Current Proposal ---`));
          console.log(`${chalk.yellow("Topic:")} ${brief.topic}`);
          console.log(`${chalk.yellow("Goal:")} ${brief.goal}`);
          console.log(`${chalk.yellow("Audience:")} ${brief.audience}`);
          console.log(`${chalk.yellow("Assembler:")} ${brief.assemblerId}`);
          console.log(`${chalk.yellow("Persona:")}   ${brief.personaId}\n`);

          const { action } = await inquirer.prompt([
            {
              type: "list",
              name: "action",
              message: "Action:",
              choices: [
                { name: "🚀 Proceed", value: "proceed" },
                { name: "💬 Feedback", value: "feedback" },
              ],
            },
          ]);

          if (action === "proceed") return { action: "proceed" };

          const { feed } = await inquirer.prompt([
            {
              type: "input",
              name: "feed",
              message: chalk.cyan("You:"),
              validate: (v) => !!v,
            },
          ]);

          return { action: "feedback", content: feed };
        },

        onRetry: cliRetryHandler,
        onThinking: () =>
          console.log(chalk.blue("\n🧠 Architect is thinking...")),
      });

      if (!brief) return;

      const assembler = assemblers.find(
        (a) => a.artifact.id === brief.assemblerId,
      );

      if (!assembler) {
        throw new Error(
          `Assembler "${brief.assemblerId}" not found in workspace. ` +
            `Available: ${assemblers.map((a) => a.artifact.id).join(", ")}`,
        );
      }

      console.log(
        chalk.cyan(
          `\n🏗️  Requesting structure from ${chalk.bold(brief.assemblerId)}...`,
        ),
      );

      const { blueprint } = await assembler.agent.assemble({
        audience: brief.audience,
        goal: brief.goal,
        topic: brief.topic,
        validator: async (blueprint) => {
          console.log(chalk.bold.cyan("\n📋 Intelligent Blueprint Summary:"));
          console.log(chalk.white(`\nTITLE: ${brief.topic}`));
          console.log(chalk.white(`HUB ID: ${blueprint.hubId}\n`));

          blueprint.components.forEach((c, i) => {
            console.log(
              chalk.white(`#${i + 1} [${c.writerId.toUpperCase()}] `) +
                chalk.bold(c.header),
            );
            console.log(chalk.gray(`  INTENT: ${c.intent}`));
          });

          const { confirmed } = await inquirer.prompt([
            {
              type: "confirm",
              name: "confirmed",
              message: "Does this structure look good?",
              default: true,
            },
          ]);

          if (confirmed) {
            return { confirmed };
          }

          const { feedback } = await inquirer.prompt([
            {
              type: "input",
              name: "feedback",
              message: chalk.cyan("You:"),
              validate: (v) => !!v,
            },
          ]);

          return { confirmed: false, feedback };
        },
        onRetry: cliRetryHandler,
      });

      const hubDir = await IoService.createHubDirectory(blueprint.hubId);
      const filePath = path.join(hubDir, "hub.md");
      const fileContent = ParserService.generateScaffold(
        "hub",
        brief,
        blueprint,
      );
      await IoService.safeWriteFile(filePath, fileContent);

      console.log(
        chalk.bold.green(`✅ Hub scaffolded at posts/${blueprint.hubId}\n`),
      );

      const { shouldFill } = await inquirer.prompt([
        {
          type: "confirm",
          name: "shouldFill",
          message: "Generate content now?",
          default: true,
        },
      ]);

      if (!shouldFill) {
        return;
      }

      const persona = personas.find((p) => p.artifact.id === brief.personaId);

      if (!persona) {
        throw new Error(
          `Persona "${brief.personaId}" not found in workspace. ` +
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
            chalk.gray(`   Generating section [${writerId}]: "${id}"... `),
          ),
        () => console.log(chalk.green("      Done ✅")),
        cliRetryHandler,
      );

      console.log(chalk.bold.cyan("🚀 Hub populated successfully!\n"));

      const { shouldAudit } = await inquirer.prompt([
        {
          type: "confirm",
          name: "shouldAudit",
          message: "Run a semantic audit on the new content?",
          default: true,
        },
      ]);

      if (!shouldAudit) {
        return;
      }

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
      const auditor = auditors.find((a) => a.artifact.id === auditorId)!;

      if (!auditor) {
        throw new Error(
          `Auditor "${auditorId}" not found in workspace. ` +
            `Available: ${auditors.map((a) => a.artifact.id).join(", ")}`,
        );
      }

      console.log(
        chalk.cyan(`\n🧠 Running Step 2: Semantic Analysis [${auditorId}]...`),
      );

      const { allIssues } = await ValidationService.runFullAudit(
        filePath,
        auditor.agent,
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
      console.error(chalk.red("\n❌ Command `new` Error:"), error);
    }
  });

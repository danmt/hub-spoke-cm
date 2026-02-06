// src/cli/commands/audit.ts
import { GoogleGenAI } from "@google/genai";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { IoService } from "../services/IoService.js";
import { RegistryService } from "../services/RegistryService.js";
import { ValidationService } from "../services/ValidationService.js";
import { getGlobalConfig } from "../utils/config.js";

/**
 * auditCommand
 * Leverages the centralized ValidationService to perform a multi-pass
 * semantic audit and provides an interactive interface for applying fixes.
 */
export const auditCommand = new Command("audit")
  .description(
    "Run a multi-pass semantic audit using the centralized Validation Service",
  )
  .option(
    "-f, --file <path>",
    "Specific markdown file to audit (defaults to hub.md)",
  )
  .action(async (options) => {
    try {
      const config = getGlobalConfig();
      const client = new GoogleGenAI({ apiKey: config.apiKey! });
      const workspaceRoot = await IoService.findWorkspaceRoot(process.cwd());

      let targetFile: string;
      let hubDir: string;

      if (options.file) {
        targetFile = path.resolve(process.cwd(), options.file);
        hubDir = await IoService.findHubRoot(path.dirname(targetFile));
      } else {
        const hubs = await IoService.findAllHubsInWorkspace(workspaceRoot);
        if (hubs.length === 0) throw new Error("No hubs found in workspace.");

        const { targetHub } = await inquirer.prompt([
          {
            type: "list",
            name: "targetHub",
            message: "Select a Hub to audit:",
            choices: hubs,
          },
        ]);
        hubDir = path.join(workspaceRoot, "posts", targetHub);
        targetFile = path.join(hubDir, "hub.md");
      }

      const hubMeta = await IoService.readHubMetadata(hubDir);

      // 1. Structural Integrity Check
      console.log(
        chalk.blue(
          `\n🛡️  Step 1: Integrity Check [${path.basename(targetFile)}]`,
        ),
      );
      const integrity = await ValidationService.checkIntegrity(
        targetFile,
        hubMeta.personaId,
        hubMeta.language,
      );

      if (!integrity.isValid) {
        console.log(chalk.red("   ❌ Structural issues found:"));
        integrity.issues.forEach((i) =>
          console.log(chalk.gray(`      - ${i}`)),
        );
        return console.log(
          chalk.yellow(
            "\nAbort: Resolve structural issues before semantic audit.",
          ),
        );
      }

      // 2. Agent Initialization
      const artifacts = await RegistryService.getAllArtifacts();
      const agents = RegistryService.initializeAgents(
        config,
        client,
        artifacts,
      );
      const auditors = RegistryService.getAgentsByType(agents, "auditor");

      if (auditors.length === 0)
        throw new Error("No auditors found in registry.");

      const { auditorId } = await inquirer.prompt([
        {
          type: "list",
          name: "auditorId",
          message: "Select Auditor:",
          choices: auditors.map((a) => ({
            name: `${a.artifact.id}: ${a.artifact.description}`,
            value: a.artifact.id,
          })),
        },
      ]);

      const selectedAuditor = auditors.find(
        (a) => a.artifact.id === auditorId,
      )!;

      // 3. Centralized Multi-Pass Audit
      console.log(
        chalk.cyan(`\n🧠 Step 2: Running Orchestrated Audit [${auditorId}]...`),
      );

      const { report, allIssues } = await ValidationService.runFullAudit(
        config,
        client,
        targetFile,
        selectedAuditor.agent,
      );

      if (allIssues.length === 0) {
        return console.log(
          chalk.bold.green("\n✨ Audit passed! No semantic issues found."),
        );
      }

      // 4. Interactive Consolidation and Fixes
      console.log(
        chalk.yellow(
          `\n⚠️  Auditor found ${allIssues.length} potential improvements:`,
        ),
      );
      console.log(chalk.dim(`   Assessment: ${report.summary}\n`));

      allIssues.forEach((issue, index) => {
        console.log(
          `${chalk.bold(index + 1 + ".")} [${chalk.cyan(issue.section)}] ${issue.message}`,
        );
      });

      const { toFix } = await inquirer.prompt([
        {
          type: "checkbox",
          name: "toFix",
          message: "\nSelect issues to fix surgically:",
          choices: allIssues.map((i) => ({
            name: `${i.section}: ${i.type} (${i.severity})`,
            value: i,
          })),
        },
      ]);

      for (const issue of toFix) {
        process.stdout.write(chalk.gray(`   🔧 Fixing "${issue.section}"... `));
        const result = await ValidationService.verifyAndFix(
          config,
          client,
          targetFile,
          issue,
          selectedAuditor.agent,
        );

        if (result.success) {
          console.log(chalk.green("Verified & Merged ✅"));
        } else {
          console.log(chalk.red("Failed ❌"));
          console.log(chalk.dim(`      Reason: ${result.message}`));
        }
      }

      console.log(
        chalk.bold.green("\n🚀 Audit and Refactoring session complete."),
      );
    } catch (error) {
      console.error(
        chalk.red("\n❌ Audit Error:"),
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

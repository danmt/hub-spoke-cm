// src/commands/audit.ts
import chalk from "chalk";
import { Command } from "commander";
import fs from "fs/promises";
import inquirer from "inquirer";
import path from "path";
import { AuditIssue } from "../agents/Auditor.js";
import { IoService } from "../services/IoService.js";
import { LoggerService } from "../services/LoggerService.js";
import { RegistryService } from "../services/RegistryService.js";
import { ValidationService } from "../services/ValidationService.js";
import { cliRetryHandler } from "../utils/cliRetryHandler.js";

export const auditCommand = new Command("audit")
  .description(
    "Guided semantic audit with atomic safety and persistent reports",
  )
  .option("-f, --file <path>", "Specific file to audit")
  .action(async (options) => {
    try {
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
      const agents = RegistryService.initializeAgents(artifacts);
      const auditors = RegistryService.getAgentsByType(agents, "auditor");
      const writers = RegistryService.getAgentsByType(agents, "writer");
      const persona = RegistryService.getAgentsByType(agents, "persona").find(
        (p) => p.artifact.id === hubMeta.personaId,
      );

      if (auditors.length === 0)
        throw new Error("No auditors found in registry.");
      if (!persona) throw new Error(`Persona ${hubMeta.personaId} not found.`);

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

      // 3. Centralized Multi-Pass Audit
      console.log(
        chalk.cyan(`\n🧠 Step 2: Running Orchestrated Audit [${auditorId}]...`),
      );
      console.log(chalk.blue(`\n🛡️  Auditing: ${path.basename(targetFile)}`));

      const { allIssues, workingFile, staticReport } =
        await ValidationService.runFullAudit(
          targetFile,
          selectedAuditor.agent,
          persona,
          (header) =>
            console.log(chalk.gray(`   🔎  Auditing "${header}"... `)),
          () => console.log(chalk.green("      Done ✅")),
          cliRetryHandler,
        );

      // Save persistent audit trace
      const reportPath = await IoService.saveAuditReport(
        workspaceRoot,
        path.basename(hubDir),
        {
          file: targetFile,
          auditor: auditorId,
          metrics: staticReport,
          issues: allIssues,
        },
      );
      console.log(
        chalk.dim(`📊 History: .hub/audits/${path.basename(reportPath)}`),
      );

      if (allIssues.length === 0) {
        await fs.unlink(workingFile);
        return console.log(chalk.bold.green("\n✨ No issues found."));
      }

      // 4. Interactive Consolidation and Fixes
      console.log(
        chalk.yellow(
          `\n⚠️  Auditor found ${allIssues.length} potential improvements:`,
        ),
      );

      const groupedIssues = allIssues.reduce(
        (acc, issue) => {
          if (!acc[issue.section]) acc[issue.section] = [];
          acc[issue.section].push(issue);
          return acc;
        },
        {} as Record<string, AuditIssue[]>,
      );

      let fixesApplied = 0;
      for (const sectionName of Object.keys(groupedIssues)) {
        const issues = groupedIssues[sectionName];

        console.log(`\n📦 ${chalk.bold.underline("Section: " + sectionName)}`);
        issues.forEach((i) => {
          const color = i.severity === "high" ? chalk.red : chalk.yellow;
          console.log(`  ${color("•")} ${i.message}`);
        });

        const { action } = await inquirer.prompt([
          {
            type: "list",
            name: "action",
            message: `Fix these ${issues.length} issues?`,
            choices: [
              { name: "🚀 Apply Batch Fix", value: "fix" },
              { name: "⏭️  Skip Section", value: "skip" },
              { name: "🛑 Abort", value: "abort" },
            ],
          },
        ]);

        if (action === "abort") break;
        if (action === "skip") continue;

        let isFixed = false;
        while (!isFixed) {
          const result = await ValidationService.verifyAndFix(
            workingFile,
            sectionName,
            issues,
            selectedAuditor.agent,
            persona,
            writers,
            ({ header, writerId }) =>
              console.log(
                chalk.gray(
                  `   🏗️  Fixing & Verifying [${writerId}] "${header}"... `,
                ),
              ),
            () => console.log(chalk.green("Done ✅")),
            cliRetryHandler,
          );

          if (result.success) {
            console.log(chalk.green("Verified ✅"));
            fixesApplied++;
            isFixed = true;
          } else {
            console.log(chalk.red("Failed ❌"));
            console.log(
              chalk.italic.red(`      Audit Feedback: ${result.message}`),
            );

            const { retry } = await inquirer.prompt([
              {
                type: "confirm",
                name: "retry",
                message: "     Retry with different generation?",
                default: true,
              },
            ]);
            if (!retry) break;
          }
        }
      }

      // FINAL COMMIT
      if (fixesApplied > 0) {
        const { merge } = await inquirer.prompt([
          {
            type: "confirm",
            name: "merge",
            message: `Merge ${fixesApplied} verified changes?`,
            default: true,
          },
        ]);
        if (merge) {
          await ValidationService.finalize(workingFile, targetFile);
          console.log(chalk.bold.green("🚀 Atomic merge complete."));
        } else {
          await fs.unlink(workingFile);
        }
      } else {
        await fs.unlink(workingFile);
      }
    } catch (error: any) {
      await LoggerService.error("Audit Command Fatal Error", {
        error: error.message,
        stack: error.stack,
      });
      console.error(chalk.red("\n❌ Command `audit` Error:"), error.message);
      process.exit(1);
    }
  });

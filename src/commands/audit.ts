import { GoogleGenAI } from "@google/genai";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { IoService } from "../services/IoService.js";
import { RegistryService } from "../services/RegistryService.js";
import { ValidationService } from "../services/ValidationService.js";
import { getGlobalConfig } from "../utils/config.js";

export const auditCommand = new Command("audit")
  .description("Semantic audit with structural integrity enforcement")
  .option("-f, --file <path>", "Specific markdown file to audit")
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
        const { targetHub } = await inquirer.prompt([
          {
            type: "list",
            name: "targetHub",
            message: "Select Hub to audit:",
            choices: hubs,
          },
        ]);
        hubDir = path.join(workspaceRoot, "posts", targetHub);
        targetFile = path.join(hubDir, "hub.md");
      }

      const hubMeta = await IoService.readHubMetadata(hubDir);

      // Phase 1: Structural Check (Centralized logic)
      console.log(
        chalk.blue(
          `\n🛡️  Step 1: Structural Check [${path.basename(targetFile)}]`,
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
            "\nAbort: Please fix structural issues or run 'hub fill' first.",
          ),
        );
      }
      console.log(chalk.green("   ✅ Structure is valid."));

      // Phase 2: Semantic Audit
      const artifacts = await RegistryService.getAllArtifacts();
      const agents = RegistryService.initializeAgents(
        config,
        client,
        artifacts,
      );
      const auditors = RegistryService.getAgentsByType(agents, "auditor");

      if (auditors.length === 0)
        throw new Error("No auditors found in /agents/auditors.");

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
        chalk.cyan(`\n🧠 Step 2: Semantic Analysis [${auditorId}]...`),
      );
      const report = await ValidationService.runAudit(
        config,
        client,
        targetFile,
        selectedAuditor.agent,
      );

      if (report.issues.length === 0) {
        return console.log(
          chalk.bold.green(
            "\n✨ No semantic issues found. Content is optimal.",
          ),
        );
      }

      console.log(
        chalk.yellow(
          `\n⚠️  Auditor found ${report.issues.length} potential improvements:`,
        ),
      );
      report.issues.forEach((i) =>
        console.log(chalk.bold(`   - [${i.section}] ${i.message}`)),
      );

      const { toFix } = await inquirer.prompt([
        {
          type: "checkbox",
          name: "toFix",
          message: "Apply verified fixes?",
          choices: report.issues.map((i) => ({
            name: `${i.section}: ${i.type}`,
            value: i,
          })),
        },
      ]);

      for (const issue of toFix) {
        process.stdout.write(
          chalk.gray(`   🔧 Verifying fix for "${issue.section}"... `),
        );
        const result = await ValidationService.verifyAndFix(
          config,
          client,
          targetFile,
          issue,
          selectedAuditor.agent,
        );

        if (result.success) {
          console.log(chalk.green("Fixed & Verified ✅"));
        } else {
          console.log(chalk.red("Failed verification ❌"));
          console.log(chalk.dim(`      Reason: ${result.message}`));
        }
      }
      console.log(chalk.bold.green("\n🚀 Audit session complete."));
    } catch (error) {
      console.error(
        chalk.red("\n❌ Audit Error:"),
        error instanceof Error ? error.message : String(error),
      );
    }
  });

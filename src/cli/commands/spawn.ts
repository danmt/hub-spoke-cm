import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { generateContent, generateSpokeStructure } from "../../core/ai.js";
import {
  findHubRoot,
  readHubFile,
  readHubMetadata,
  safeWriteFile,
} from "../../core/io.js";
import { parseMarkdown, reconstructMarkdown } from "../../core/parser.js";
import { runFillLogic } from "./fill.js";

export const spawnCommand = new Command("spawn")
  .description("Interactively architect a new Spoke article")
  .argument("[slug]", "The filename slug for the new spoke")
  .option(
    "-c, --component <header>",
    "Link to a specific Hub Header (fuzzy match)",
  )
  .action(async (slugArg, options) => {
    try {
      const rootDir = await findHubRoot(process.cwd());

      // 1. Load Context from Hub.md (No JSON)
      const metadata = await readHubMetadata(rootDir);
      const hubGoal = metadata.goal || metadata.title;
      const language = metadata.language || "English";

      const rawHubContent = await readHubFile(rootDir);
      const parsedHub = parseMarkdown(rawHubContent);

      // 2. Identify Target Section
      // We link based on existing headers in hub.md
      let selectedHeader: string | undefined;

      if (options.component) {
        // Try to find exact or fuzzy match
        const headers = Object.keys(parsedHub.sections);
        selectedHeader = headers.find((h) =>
          h.toLowerCase().includes(options.component.toLowerCase()),
        );
        if (!selectedHeader) {
          console.log(
            chalk.yellow(
              `Warning: Could not find header matching "${options.component}". Spoke will be global.`,
            ),
          );
        }
      } else {
        const { selection } = await inquirer.prompt([
          {
            type: "list",
            name: "selection",
            message: "Link this spoke to which Hub section?",
            choices: [
              { name: "None (Global/General)", value: undefined },
              ...Object.keys(parsedHub.sections).map((h) => ({
                name: h,
                value: h,
              })),
            ],
          },
        ]);
        selectedHeader = selection;
      }

      // 3. Determine Slug
      let slug = slugArg;
      if (!slug) {
        const { inputSlug } = await inquirer.prompt([
          {
            type: "input",
            name: "inputSlug",
            message: 'Filename slug (e.g. "advanced-patterns"):',
            validate: (val) =>
              /^[a-z0-9-]+$/.test(val) ||
              "Lowercase letters, numbers, and dashes only.",
          },
        ]);
        slug = inputSlug;
      }

      // 4. The Conversation (Architecting)
      const { spokeGoal } = await inquirer.prompt([
        {
          type: "input",
          name: "spokeGoal",
          message: `What is the specific goal of this article?`,
          default: selectedHeader
            ? `Deep dive into ${selectedHeader}`
            : `Expand on ${hubGoal}`,
        },
      ]);

      console.log(
        chalk.yellow(`\n🧠 Drafting structure for "${slug}" in ${language}...`),
      );

      const title = slug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      const context = selectedHeader
        ? `Parent Section Content: "${parsedHub.sections[selectedHeader] || ""}"`
        : "";

      // 5. Generate Structure
      const structure = await generateSpokeStructure(
        title,
        hubGoal,
        `${spokeGoal}. ${context}`,
        language,
      );

      console.log(chalk.cyan("\nProposed Structure:"));
      structure.forEach((s) =>
        console.log(`  - ${chalk.bold(s.header)}: ${chalk.gray(s.intent)}`),
      );

      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: "Create this file?",
          default: true,
        },
      ]);
      if (!confirm) return;

      // 6. Create Spoke File
      console.log(chalk.white("   Writing skeleton..."));
      const intro = await generateContent(
        hubGoal,
        title,
        `Write a compelling intro for a spoke article about: ${spokeGoal}.`,
        language,
      );

      const spokeContent = [
        "---",
        `title: "${title}"`,
        'type: "spoke"',
        `hubId: "${metadata.hubId}"`,
        // We use the slug as the component ID for linking context
        selectedHeader ? `componentId: "${slug}"` : "",
        `date: "${new Date().toISOString().split("T")[0]}"`,
        "---",
        "",
        `# ${title}`,
        "",
        `> ⬅️ [${metadata.title}](../hub.md)`,
        "",
        intro,
        "",
        // The Blockquote TODO Pattern
        ...structure.map(
          (s) =>
            `## ${s.header}\n\n> **TODO:** ${s.intent}\n\n*Pending generation...*\n`,
        ),
      ]
        .filter((l) => l !== "")
        .join("\n");

      const spokePath = path.join(rootDir, "spokes", `${slug}.md`);
      await safeWriteFile(spokePath, spokeContent);
      console.log(chalk.green(`\n✅ Created: ./spokes/${slug}.md`));

      // 7. Link Back to Hub
      if (selectedHeader) {
        let sectionContent = parsedHub.sections[selectedHeader] || "";

        // Check if link already exists to avoid duplication
        if (!sectionContent.includes(slug)) {
          sectionContent += `\n\n👉 [${title}](./spokes/${slug}.md)`;
          parsedHub.sections[selectedHeader] = sectionContent;

          // Reconstruct Hub
          const newHubContent = [
            "---",
            Object.entries(parsedHub.frontmatter)
              .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
              .join("\n"),
            "---",
            "",
            reconstructMarkdown(
              parsedHub.sections,
              Object.keys(parsedHub.sections),
            ),
          ].join("\n");

          await safeWriteFile(path.join(rootDir, "hub.md"), newHubContent);
          console.log(
            chalk.green(
              `   Linked: Added reference to hub.md under "${selectedHeader}"`,
            ),
          );
        } else {
          console.log(
            chalk.yellow(`   Skipped Link: Reference already exists.`),
          );
        }
      }

      // 8. Auto-Fill Prompt
      const { doFill } = await inquirer.prompt([
        {
          type: "confirm",
          name: "doFill",
          message: "Do you want to generate the content now?",
          default: true,
        },
      ]);

      if (doFill) {
        await runFillLogic(spokePath, hubGoal, language);
      }
    } catch (error) {
      console.error(
        chalk.red("Spawn failed:"),
        error instanceof Error ? error.message : String(error),
      );
    }
  });

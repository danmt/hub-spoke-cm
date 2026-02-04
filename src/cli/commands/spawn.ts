import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import path from "path";
import { generateContent } from "../../core/ai.js";
import {
  findHubRoot,
  readAnatomy,
  readHubFile,
  safeWriteFile,
} from "../../core/io.js";
import { parseMarkdown, reconstructMarkdown } from "../../core/parser.js";
// Explicit .js extension for NodeNext compatibility
import { HubComponent } from "../../types/index.js";

export const spawnCommand = new Command("spawn")
  .description("Create a new Spoke article linked to a Hub Component")
  .argument(
    "[slug]",
    'The filename slug for the new spoke (e.g., "advanced-configuration")',
  )
  .option("-c, --component <id>", "The Hub Component ID to link this spoke to")
  .action(async (slugArg, options) => {
    try {
      // 1. Setup Context
      const rootDir = await findHubRoot(process.cwd());
      const anatomy = await readAnatomy(rootDir);
      const rawHubContent = await readHubFile(rootDir);
      const parsedHub = parseMarkdown(rawHubContent);

      // 2. Determine Slug & Target Component
      let slug = slugArg;
      if (!slug) {
        const answer = await inquirer.prompt([
          {
            type: "input",
            name: "slug",
            message: "Enter a filename slug for the spoke (no extension):",
            validate: (input) =>
              /^[a-z0-9-]+$/.test(input)
                ? true
                : "Use only lowercase letters, numbers, and dashes.",
          },
        ]);
        slug = answer.slug;
      }

      let targetComponent: HubComponent | undefined;

      if (options.component) {
        targetComponent = anatomy.components.find(
          (c) => c.id === options.component,
        );
        if (!targetComponent) {
          console.error(
            chalk.red(`Component ID '${options.component}' not found.`),
          );
          return;
        }
      } else {
        // Interactive Selection
        const { selected } = await inquirer.prompt([
          {
            type: "list",
            name: "selected",
            message: "Which Hub section does this spoke elaborate on?",
            choices: [
              { name: "None (Global Spoke)", value: undefined },
              ...anatomy.components.map((c) => ({
                name: `${c.header} (${c.id})`,
                value: c,
              })),
            ],
          },
        ]);
        targetComponent = selected;
      }

      console.log(chalk.blue(`\n🌱 Spawning Spoke: ${slug}.md`));

      // 3. Generate Content (SRS 4.3.2)
      // We need a title and an intro.
      const title = slug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase()); // naive title case
      const hubContext = targetComponent
        ? `This article elaborates on the "${targetComponent.header}" section of the "${anatomy.goal}" guide.`
        : `This is a deep dive related to the "${anatomy.goal}" project.`;

      const intro = await generateContent(
        anatomy.goal,
        title,
        `Write a compelling introduction for this specific article. ${hubContext}`,
        targetComponent ? parsedHub.sections[targetComponent.header] : "", // Pass parent content as context
      );

      // 4. Create Spoke File
      const spokeContent = [
        "---",
        `title: "${title}"`,
        'type: "spoke"',
        `hubId: "${anatomy.hubId}"`,
        targetComponent ? `componentId: "${targetComponent.id}"` : "",
        `date: "${new Date().toISOString().split("T")[0]}"`,
        "---",
        "",
        `# ${title}`,
        "",
        `> Part of the [${anatomy.goal}](../hub.md) series.`,
        "",
        intro,
        "",
        "## Next Steps",
        "Content pending...",
      ]
        .filter((line) => line !== "")
        .join("\n"); // Filter removes empty componentId line if undefined

      const spokePath = path.join(rootDir, "spokes", `${slug}.md`);
      await safeWriteFile(spokePath, spokeContent);
      console.log(chalk.green(`   Created: ./spokes/${slug}.md`));

      // 5. Update Hub (Backlinking) - SRS 4.3.2
      if (targetComponent) {
        const header = targetComponent.header;
        let sectionContent = parsedHub.sections[header] || "";

        // Avoid duplicate links
        const linkMarkdown = `\n\n👉 **Read more:** [${title}](./spokes/${slug}.md)`;
        if (!sectionContent.includes(slug)) {
          sectionContent += linkMarkdown;

          // Update the ParsedHub object
          parsedHub.sections[header] = sectionContent;

          // Reconstruct and Save Hub
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
              `   Linked: Added reference to hub.md under "${header}"`,
            ),
          );
        } else {
          console.log(
            chalk.yellow(`   Skipped Link: Reference already exists in hub.md`),
          );
        }
      }
    } catch (error) {
      console.error(
        chalk.red("Spawn failed:"),
        error instanceof Error ? error.message : String(error),
      );
    }
  });

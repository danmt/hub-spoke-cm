import chalk from "chalk";
import { Command } from "commander";
import fs from "fs/promises";
import matter from "gray-matter";
import inquirer from "inquirer";
import path from "path";
import { IoService } from "../services/IoService.js";
import { ParserService } from "../services/ParserService.js";

export const mapCommand = new Command("map")
  .description("Visualize the Hub & Spoke content structure")
  .action(async () => {
    try {
      // 1. Load Context
      const workspaceRoot = await IoService.findWorkspaceRoot(process.cwd());
      const hubs = await IoService.findAllHubsInWorkspace(workspaceRoot);

      if (hubs.length === 0) throw new Error("No hubs found in workspace.");

      const { targetHub } = await inquirer.prompt([
        {
          type: "list",
          name: "targetHub",
          message: "Select a Hub to map:",
          choices: hubs,
        },
      ]);

      const rootDir = path.join(workspaceRoot, "posts", targetHub);
      const metadata = await IoService.readHubMetadata(rootDir);
      const rawHubContent = await IoService.readHubFile(rootDir);
      const parsedHub = ParserService.parseMarkdown(rawHubContent);

      console.log(
        chalk.blue(`\n🗺️  Content Map: ${chalk.bold(metadata.title)}`),
      );
      console.log(chalk.gray(`   Goal: ${metadata.goal || "N/A"}`));
      console.log(chalk.gray(`   Lang: ${metadata.language}\n`));

      // 2. Scan Spokes
      const spokesDir = path.join(rootDir, "spokes");
      let spokeFiles: string[] = [];
      try {
        spokeFiles = (await fs.readdir(spokesDir)).filter((f) =>
          f.endsWith(".md"),
        );
      } catch (e) {
        // Spokes dir might not exist yet
      }

      // 3. Map Spokes to Sections
      // Data Structure: { "Section Name": ["spoke1.md", "spoke2.md"] }
      const tree: Record<string, string[]> = {};
      const orphans: string[] = [];

      // Initialize tree with Hub Sections
      Object.keys(parsedHub.sections).forEach((header) => {
        tree[header] = [];
      });

      // Process each spoke
      for (const file of spokeFiles) {
        const filePath = path.join(spokesDir, file);
        const content = await fs.readFile(filePath, "utf-8");
        const { data: spokeFm } = matter(content);
        const spokeTitle = spokeFm.title || file;

        let isLinked = false;

        // Strategy A: Check if Spoke Frontmatter explicitly links to a component
        // (We used componentId in spawn.ts, though often it's just the slug now)
        // This is less reliable in the No-JSON version, so we rely on Strategy B mostly.

        // Strategy B: Check if Hub Section *content* links to this file
        // Link format: ./spokes/filename.md
        for (const [header, body] of Object.entries(parsedHub.sections)) {
          if (body.includes(file)) {
            tree[header].push(spokeTitle);
            isLinked = true;
            break; // Assuming a spoke belongs to one primary section
          }
        }

        if (!isLinked) {
          orphans.push(spokeTitle);
        }
      }

      // 4. Render the Tree
      // Root
      console.log(chalk.yellow(`📦 ${metadata.title} (Hub)`));

      // Sections
      const headers = Object.keys(tree);
      headers.forEach((header, index) => {
        const isLastSection =
          index === headers.length - 1 && orphans.length === 0;
        const prefix = isLastSection ? "└──" : "├──";

        // Status indicator (check for TODOs)
        const sectionBody = parsedHub.sections[header];
        const hasTodo = />\s*\*\*?TODO:?\*?/i.test(sectionBody);
        const statusIcon = hasTodo ? chalk.red("○") : chalk.green("●");

        console.log(`${prefix} ${statusIcon} ${chalk.bold(header)}`);

        // Spokes inside this section
        const spokes = tree[header];
        spokes.forEach((spoke, sIndex) => {
          const isLastSpoke = sIndex === spokes.length - 1;
          const sectionIndent = isLastSection ? "    " : "│   ";
          const spokePrefix = isLastSpoke ? "└──" : "├──";

          console.log(`${sectionIndent}${spokePrefix} 📄 ${spoke}`);
        });
      });

      // Global/Orphaned Spokes
      if (orphans.length > 0) {
        console.log(`└── 🌍 Global / Unlinked`);
        orphans.forEach((spoke, index) => {
          const isLast = index === orphans.length - 1;
          const prefix = isLast ? "    └──" : "    ├──";
          console.log(`${prefix} 📄 ${spoke}`);
        });
      }

      console.log(chalk.gray("\nLegend: ● Done  ○ Pending\n"));
    } catch (error) {
      console.error(
        chalk.red("\n❌ Command `map` Error:"),
        error instanceof Error ? error.message : String(error),
      );
    }
  });

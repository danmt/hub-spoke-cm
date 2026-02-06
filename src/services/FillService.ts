// src/services/FillService.ts
import { GoogleGenAI } from "@google/genai";
import chalk from "chalk";
import fs from "fs/promises";
import inquirer from "inquirer";
import { GlobalConfig } from "../utils/config.js";
import { IoService } from "./IoService.js";
import { ParserService } from "./ParserService.js";
import { RegistryService } from "./RegistryService.js";

const TODO_REGEX = />\s*\*\*?TODO:?\*?\s*(.*)/i;

export class FillService {
  static async execute(
    config: GlobalConfig,
    client: GoogleGenAI,
    filePath: string,
    autoAccept = false,
  ) {
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = ParserService.parseMarkdown(content);
    const sectionHeaders = Object.keys(parsed.sections);

    const fillableEntries = Object.entries(parsed.sections).filter(
      ([_, body]) => TODO_REGEX.test(body),
    );

    if (fillableEntries.length === 0) return;

    let headersToFill = fillableEntries.map(([header]) => header);

    if (!autoAccept) {
      const { selection } = await inquirer.prompt([
        {
          type: "checkbox",
          name: "selection",
          message: "Select sections to generate (Sequential):",
          choices: headersToFill.map((h) => ({ name: h, checked: true })),
        },
      ]);
      headersToFill = selection;
    }

    const rawArtifacts = await RegistryService.getAllArtifacts();
    const agents = RegistryService.initializeAgents(
      config,
      client,
      rawArtifacts,
    );
    const personas = RegistryService.getAgentsByType(agents, "persona");
    const writers = RegistryService.getAgentsByType(agents, "writer");

    const {
      personaId = "standard",
      writerMap = {},
      title,
      goal = "",
      audience = "",
      language = "English",
      bridges = {},
    } = parsed.frontmatter;

    const activePersona = personas.find((p) => p.artifact.id === personaId);
    if (!activePersona) throw new Error(`Persona "${personaId}" not found.`);

    const updatedSections = { ...parsed.sections };
    const updatedBridges = { ...bridges };

    for (let i = 0; i < sectionHeaders.length; i++) {
      const header = sectionHeaders[i];
      if (!headersToFill.includes(header)) continue;

      const body = updatedSections[header];
      const intent = body.match(TODO_REGEX)?.[1]?.trim() || "Expand details.";
      const writerId = (writerMap as any)[header] || "prose";
      const writer = writers.find((w) => w.artifact.id === writerId);

      if (!writer) throw new Error(`Writer "${writerId}" not found.`);

      // Get the bridge from the actual previous section in the sequence
      const prevHeader = sectionHeaders[i - 1];
      const currentBridge = prevHeader ? updatedBridges[prevHeader] : "";

      const upcomingIntents = sectionHeaders
        .slice(i + 1)
        .map(
          (h) =>
            `[${h}]: ${(parsed.frontmatter.blueprint as any)?.[h]?.intent || "Next topic"}`,
        );

      process.stdout.write(
        chalk.gray(`   Generating [${writerId}] "${header}"... `),
      );

      try {
        const response = await writer.agent.write({
          header,
          intent,
          topic: title,
          goal,
          audience,
          language,
          persona: activePersona.agent,
          precedingBridge: currentBridge,
          upcomingIntents,
          isFirst: i === 0,
          isLast: i === sectionHeaders.length - 1,
        });

        updatedSections[header] = response.content;
        updatedBridges[header] = response.bridge;
        process.stdout.write(chalk.green("Done ✅\n"));
      } catch (err) {
        process.stdout.write(chalk.red("Failed ❌\n"));
        const { retry } = await inquirer.prompt([
          { type: "confirm", name: "retry", message: "Retry section?" },
        ]);
        if (retry) {
          i--;
          continue;
        }
        break;
      }
    }

    const finalMarkdown = ParserService.reconstructMarkdown(
      { ...parsed.frontmatter, bridges: updatedBridges },
      updatedSections,
    );
    await IoService.safeWriteFile(filePath, finalMarkdown);
  }
}

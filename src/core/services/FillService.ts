// src/core/services/FillService.ts
import chalk from "chalk";
import fs from "fs/promises";
import inquirer from "inquirer";
import { WRITER_REGISTRY } from "../writers/index.js";
import { IoService } from "./IoService.js";
import { ParserService } from "./ParserService.js";

const TODO_REGEX = />\s*\*\*?TODO:?\*?\s*(.*)/i;

export class FillService {
  static async execute(filePath: string, autoAccept = false) {
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = ParserService.parseMarkdown(content);

    // Identify sections that actually need work
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
          message: "Select sections to generate:",
          choices: headersToFill.map((h) => ({ name: h, checked: true })),
        },
      ]);
      headersToFill = selection;
    }

    if (headersToFill.length === 0) return;

    const updatedSections = { ...parsed.sections };
    const {
      personaId = "standard",
      writerMap = {} as Record<string, string>,
      title,
      goal = "",
      audience = "",
      language = "English",
    } = parsed.frontmatter;

    console.log(
      chalk.blue(`\n🖋️  Filling with Persona: ${chalk.bold(personaId)}`),
    );

    let currentQueue = [...headersToFill];

    while (currentQueue.length > 0) {
      const failedThisPass: string[] = [];

      for (const header of currentQueue) {
        const body = updatedSections[header];
        const intent = body.match(TODO_REGEX)?.[1]?.trim() || "Expand details.";

        const writerId = (writerMap as any)[header] || "prose";
        const writer = WRITER_REGISTRY[writerId] || WRITER_REGISTRY["prose"];

        process.stdout.write(
          chalk.gray(`   Generating [${writerId}] "${header}"... `),
        );

        try {
          const generated = await writer.write({
            header,
            intent,
            topic: title,
            goal,
            audience,
            language,
            personaId,
          });

          updatedSections[header] = generated;
          process.stdout.write(chalk.green("Done ✅\n"));
        } catch (err) {
          process.stdout.write(chalk.red("Failed ❌\n"));
          failedThisPass.push(header);
        }
      }

      if (failedThisPass.length > 0) {
        console.log(
          chalk.yellow(`\n⚠️  Finished with ${failedThisPass.length} errors.`),
        );
        const { retry } = await inquirer.prompt([
          {
            type: "confirm",
            name: "retry",
            message: "Would you like to retry the failed sections?",
            default: true,
          },
        ]);

        currentQueue = retry ? failedThisPass : [];
      } else {
        currentQueue = [];
      }
    }

    const finalMarkdown = ParserService.reconstructMarkdown(
      parsed.frontmatter,
      updatedSections,
    );
    await IoService.safeWriteFile(filePath, finalMarkdown);
  }
}

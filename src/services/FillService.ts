// src/services/FillService.ts
import fs from "fs/promises";
import { IoService } from "./IoService.js";
import { LoggerService } from "./LoggerService.js";
import { ParserService } from "./ParserService.js";
import { AgentPair } from "./RegistryService.js";

const TODO_REGEX = />\s*\*\*?TODO:?\*?\s*(.*)/i;

export interface FillProgress {
  header: string;
  writerId: string;
  status: "starting" | "completed" | "failed";
  error?: string;
}

export class FillService {
  /**
   * Headless engine for generating content.
   * Injects dependencies (agents) from the caller.
   */
  static async execute(
    filePath: string,
    sectionIdsToFill: string[],
    activePersona: AgentPair & { type: "persona" },
    writers: (AgentPair & { type: "writer" })[],
    onStart?: (data: { id: string; writerId: string }) => void,
    onComplete?: () => void,
    onRetry?: (err: Error) => Promise<boolean>,
  ) {
    await LoggerService.info(`FillService: Starting execution`, {
      filePath,
      sections: sectionIdsToFill.length,
    });

    const content = await fs.readFile(filePath, "utf-8");
    const parsed = ParserService.parseMarkdown(content);
    const sectionIds = Object.keys(parsed.sections);
    const blueprint = parsed.frontmatter.blueprint || {};

    const updatedSections = { ...parsed.sections };

    for (let i = 0; i < sectionIds.length; i++) {
      const sectionId = sectionIds[i];
      if (!sectionIdsToFill.includes(sectionId)) continue;

      const body = updatedSections[sectionId];
      const intent = body.match(TODO_REGEX)?.[1]?.trim() || "Expand details.";
      const writerId = blueprint[sectionId].writerId;

      const writer = writers.find((w) => w.artifact.id === writerId);

      if (!writer) {
        const error = `Writer "${writerId}" not found for section "${sectionId}".`;
        await LoggerService.error(`FillService: ${error}`);
        throw new Error(error);
      }

      onStart?.({ id: sectionIds[i], writerId });

      const neutralResult = await writer.agent.write({
        intent,
        topic: parsed.frontmatter.title,
        goal: parsed.frontmatter.goal,
        audience: parsed.frontmatter.audience,
        bridge: blueprint[sectionId].bridge,
        isFirst: i === 0,
        isLast: i === sectionIds.length - 1,
        onRetry,
      });

      const personaResult = await activePersona.agent.rephrase(
        neutralResult.header,
        neutralResult.content,
        {
          topic: parsed.frontmatter.title,
          goal: parsed.frontmatter.goal,
          audience: parsed.frontmatter.audience,
          language: parsed.frontmatter.language,
        },
        onRetry,
      );

      updatedSections[sectionId] =
        `${personaResult.header}\n\n${personaResult.content}`;
      onComplete?.();
    }

    const finalMarkdown = ParserService.reconstructMarkdown(
      parsed.frontmatter,
      updatedSections,
    );

    await IoService.safeWriteFile(filePath, finalMarkdown);
    await LoggerService.info(`FillService: File updated successfully`);
  }
}

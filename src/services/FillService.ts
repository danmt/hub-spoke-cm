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

    const updatedSections = { ...parsed.sections };
    const updatedBridges = { ...(parsed.frontmatter.bridges || {}) };

    for (let i = 0; i < sectionIds.length; i++) {
      const header = sectionIds[i];
      if (!sectionIdsToFill.includes(header)) continue;

      const body = updatedSections[header];
      const intent = body.match(TODO_REGEX)?.[1]?.trim() || "Expand details.";
      const writerId =
        (parsed.frontmatter.writerMap as any)?.[header] || "prose";
      const writer = writers.find((w) => w.artifact.id === writerId);

      if (!writer) {
        const error = `Writer "${writerId}" not found for section "${header}".`;
        await LoggerService.error(`FillService: ${error}`);
        throw new Error(error);
      }

      onStart?.({ id: sectionIds[i], writerId });

      const neutralResult = await writer.agent.write({
        intent,
        topic: parsed.frontmatter.title,
        goal: parsed.frontmatter.goal || "",
        audience: parsed.frontmatter.audience || "",
        language: parsed.frontmatter.language,
        precedingBridge: i > 0 ? updatedBridges[sectionIds[i - 1]] : undefined,
        isFirst: i === 0,
        isLast: i === sectionIds.length - 1,
        onRetry,
      });

      const personaResult = await activePersona.agent.rephrase(
        neutralResult.header,
        neutralResult.content,
        {
          topic: parsed.frontmatter.title,
          goal: parsed.frontmatter.goal || "",
          audience: parsed.frontmatter.audience || "",
          language: parsed.frontmatter.language,
        },
        onRetry,
      );

      updatedSections[header] =
        `${personaResult.header}\n\n${personaResult.content}`;
      updatedBridges[header] = neutralResult.bridge;
      onComplete?.();
    }

    const finalMarkdown = ParserService.reconstructMarkdown(
      { ...parsed.frontmatter, bridges: updatedBridges },
      updatedSections,
    );

    await IoService.safeWriteFile(filePath, finalMarkdown);
    await LoggerService.info(`FillService: File updated successfully`);
  }
}

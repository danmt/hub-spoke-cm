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
    headersToFill: string[],
    activePersona: AgentPair & { type: "persona" },
    writers: (AgentPair & { type: "writer" })[],
    onProgress?: (progress: FillProgress) => void,
  ) {
    await LoggerService.info(`FillService: Starting execution`, {
      filePath,
      sections: headersToFill.length,
    });

    const content = await fs.readFile(filePath, "utf-8");
    const parsed = ParserService.parseMarkdown(content);
    const sectionHeaders = Object.keys(parsed.sections);

    const updatedSections = { ...parsed.sections };
    const updatedBridges = { ...(parsed.frontmatter.bridges || {}) };

    for (let i = 0; i < sectionHeaders.length; i++) {
      const header = sectionHeaders[i];
      if (!headersToFill.includes(header)) continue;

      const body = updatedSections[header];
      const intent = body.match(TODO_REGEX)?.[1]?.trim() || "Expand details.";
      const writerId =
        (parsed.frontmatter.writerMap as any)?.[header] || "prose";
      const writer = writers.find((w) => w.artifact.id === writerId);

      if (!writer) {
        const error = `Writer "${writerId}" not found for section "${header}".`;
        await LoggerService.error(`FillService: ${error}`);
        onProgress?.({ header, writerId, status: "failed", error });
        throw new Error(error);
      }

      onProgress?.({ header, writerId, status: "starting" });
      await LoggerService.debug(`FillService: Generating section`, {
        header,
        writerId,
      });

      try {
        const response = await writer.agent.write({
          intent,
          topic: parsed.frontmatter.title,
          goal: parsed.frontmatter.goal || "",
          audience: parsed.frontmatter.audience || "",
          language: parsed.frontmatter.language,
          persona: activePersona.agent,
          precedingBridge:
            i > 0 ? updatedBridges[sectionHeaders[i - 1]] : undefined,
          isFirst: i === 0,
          isLast: i === sectionHeaders.length - 1,
        });

        updatedSections[header] = response.content;
        updatedBridges[header] = response.bridge;
        onProgress?.({ header, writerId, status: "completed" });
      } catch (err: any) {
        await LoggerService.error(`FillService: Section generation failed`, {
          header,
          error: err.message,
        });
        onProgress?.({
          header,
          writerId,
          status: "failed",
          error: err.message,
        });
        throw err;
      }
    }

    const finalMarkdown = ParserService.reconstructMarkdown(
      { ...parsed.frontmatter, bridges: updatedBridges },
      updatedSections,
    );

    await IoService.safeWriteFile(filePath, finalMarkdown);
    await LoggerService.info(`FillService: File updated successfully`);
  }
}

// src/services/ValidationService.ts
import fs from "fs/promises";
import path from "path";
import { LoggerService } from "./LoggerService.js";
import { ParserService } from "./ParserService.js";
import { StaticAnalysisService } from "./StaticAnalysisService.js";

export class ValidationService {
  /**
   * Static integrity check for structural failures and metadata drift.
   */
  static async checkIntegrity(
    filePath: string,
    expectedPersonaId: string,
    expectedLanguage: string,
  ): Promise<{ isValid: boolean; issues: string[] }> {
    await LoggerService.debug(`Integrity check started`, {
      file: path.basename(filePath),
    });
    const content = await fs.readFile(filePath, "utf-8");
    const { frontmatter } = ParserService.parseMarkdown(content);
    const issues: string[] = [];

    if (frontmatter.personaId !== expectedPersonaId)
      issues.push("Persona Drift.");
    if (frontmatter.language !== expectedLanguage)
      issues.push("Language Mismatch.");

    const report = StaticAnalysisService.analyze(content, expectedLanguage);
    if (report.global.totalWordCount < 100) issues.push("Content is too thin.");

    const pending = report.sections.filter((s) => s.todoCount > 0);
    pending.forEach((s) =>
      issues.push(`Pending Content: Section "${s.sectionId}" has TODOs.`),
    );

    if (issues.length > 0) {
      await LoggerService.warn(`Integrity issues found`, {
        file: path.basename(filePath),
        issues,
      });
    }

    return { isValid: issues.length === 0, issues };
  }
}

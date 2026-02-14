// src/services/ValidationService.ts
import { LoggerService } from "./LoggerService.js";
import { ParserService } from "./ParserService.js";
import { StaticAnalysisService } from "./StaticAnalysisService.js";

/**
 * Interface scoped specifically to what Validation needs.
 */
export interface ValidationProvider {
  readFile(path: string): Promise<string>;
  basename(path: string): string;
}

export class ValidationService {
  private static provider: ValidationProvider | null = null;

  static setProvider(provider: ValidationProvider): void {
    this.provider = provider;
  }

  private static ensureProvider(): ValidationProvider {
    if (!this.provider) {
      throw new Error("ValidationService: ValidationProvider not registered.");
    }
    return this.provider;
  }

  /**
   * Static integrity check for structural failures and metadata drift.
   */
  static async checkIntegrity(
    filePath: string,
    expectedPersonaId: string,
    expectedLanguage: string,
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const fp = this.ensureProvider();

    await LoggerService.debug(`Integrity check started`, {
      file: fp.basename(filePath),
    });

    const content = await fp.readFile(filePath);
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
        file: fp.basename(filePath),
        issues,
      });
    }

    return { isValid: issues.length === 0, issues };
  }
}

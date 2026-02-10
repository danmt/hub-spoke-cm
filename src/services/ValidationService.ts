// src/services/ValidationService.ts
import fs from "fs/promises";
import path from "path";
import { AuditIssue, Auditor } from "../agents/Auditor.js";
import { IoService } from "./IoService.js";
import { LoggerService } from "./LoggerService.js";
import { ParserService } from "./ParserService.js";
import { AgentPair } from "./RegistryService.js";
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
      issues.push(`Pending Content: Section "${s.header}" has TODOs.`),
    );

    if (issues.length > 0) {
      await LoggerService.warn(`Integrity issues found`, {
        file: path.basename(filePath),
        issues,
      });
    }

    return { isValid: issues.length === 0, issues };
  }

  /**
   * Orchestrates a multi-pass audit using a working copy.
   */
  static async runFullAudit(
    filePath: string,
    auditor: Auditor,
    activePersona: AgentPair & { type: "persona" },
    onStart?: (data: string) => void,
    onComplete?: () => void,
    onRetry?: (err: Error) => Promise<boolean>,
  ) {
    await LoggerService.info(`ValidationService: Full audit start`, {
      file: path.basename(filePath),
      auditor: auditor.id,
    });

    const workspaceRoot = await IoService.findWorkspaceRoot(
      path.dirname(filePath),
    );
    const workingFile = await IoService.getTempPath(
      workspaceRoot,
      path.basename(filePath),
    );

    const rawContent = await fs.readFile(filePath, "utf-8");
    await fs.writeFile(workingFile, rawContent, "utf-8");

    const parsed = ParserService.parseMarkdown(rawContent);
    const staticReport = StaticAnalysisService.analyze(
      rawContent,
      parsed.frontmatter.language,
    );
    const allIssues: AuditIssue[] = [];

    for (const sectionData of staticReport.sections) {
      await LoggerService.debug(`ValidationService: Auditing section`, {
        header: sectionData.header,
      });
      onStart?.(sectionData.header);

      const result = await auditor.audit({
        title: parsed.frontmatter.title!,
        goal: parsed.frontmatter.goal!,
        blueprint: JSON.stringify(parsed.frontmatter.blueprint || {}, null, 2),
        staticAnalysis: JSON.stringify(sectionData || {}, null, 2),
        content: parsed.sections[sectionData.header],
        persona: activePersona.agent,
        scope: "section",
        onRetry,
      });

      onComplete?.();
      allIssues.push(...result.issues);
    }

    return { allIssues, workingFile, staticReport };
  }

  /**
   * Surgical fix on the working copy with dependency injection.
   */
  static async verifyAndFix(
    workingFilePath: string,
    sectionName: string,
    issues: AuditIssue[],
    auditor: Auditor,
    activePersona: AgentPair & { type: "persona" },
    writers: (AgentPair & { type: "writer" })[],
    onStart?: (data: { header: string; writerId: string }) => void,
    onComplete?: () => void,
    onRetry?: (err: Error) => Promise<boolean>,
  ) {
    await LoggerService.debug(`ValidationService: Surgical fix`, {
      section: sectionName,
    });
    const rawContent = await fs.readFile(workingFilePath, "utf-8");
    const parsed = ParserService.parseMarkdown(rawContent);

    const sectionHeaders = Object.keys(parsed.sections);
    const sectionIndex = sectionHeaders.indexOf(sectionName);
    const writerId =
      (parsed.frontmatter.blueprint as any)?.[sectionName]?.writerId || "prose";
    const writer = writers.find((w) => w.artifact.id === writerId);

    if (!writer) {
      const error = `Writer ${writerId} missing.`;
      throw new Error(error);
    }

    try {
      onStart?.({ header: sectionName, writerId });

      const response = await writer.agent.write({
        intent: `FIX ISSUES: ${issues.map((i) => i.message).join(", ")}`,
        topic: parsed.frontmatter.title,
        goal: parsed.frontmatter.goal || "",
        audience: parsed.frontmatter.audience || "",
        language: parsed.frontmatter.language,
        persona: activePersona.agent,
        isFirst: sectionIndex === 0,
        isLast: sectionIndex === sectionHeaders.length - 1,
        onRetry,
      });

      const updatedSections = {
        ...parsed.sections,
        [sectionName]: response.content,
      };
      const candidateContent = ParserService.reconstructMarkdown(
        parsed.frontmatter,
        updatedSections,
      );

      const verification = await auditor.audit({
        title: parsed.frontmatter.title!,
        goal: parsed.frontmatter.goal!,
        blueprint: JSON.stringify(parsed.frontmatter.blueprint || {}, null, 2),
        staticAnalysis: "{}",
        content: `## ${sectionName}\n\n${response.content}`,
        persona: activePersona.agent,
        scope: "section",
        onRetry,
      });

      const success = verification.issues.length === 0;
      if (success)
        await fs.writeFile(workingFilePath, candidateContent, "utf-8");

      onComplete?.();

      return {
        success,
        message: verification.issues.map((i) => i.message).join("; "),
      };
    } catch (error: any) {
      await LoggerService.error(
        `ValidationService: verifyAndFix critical failure`,
        { section: sectionName, error: error.message },
      );
      return { success: false, message: "Surgical fix failed." };
    }
  }

  /**
   * Atomic commit: overwrites original file with verified working copy.
   */
  static async finalize(
    workingFile: string,
    originalFile: string,
  ): Promise<void> {
    await LoggerService.info(`ValidationService: Finalizing audit merge`, {
      originalFile,
    });
    await fs.rename(workingFile, originalFile);
  }
}

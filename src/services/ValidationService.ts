// src/services/ValidationService.ts
import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises";
import path from "path";
import { AuditIssue, Auditor, AuditResult } from "../agents/Auditor.js";
import { GlobalConfig } from "../utils/config.js";
import { IoService } from "./IoService.js";
import { ParserService } from "./ParserService.js";
import { RegistryService } from "./RegistryService.js";
import {
  FullAuditReport,
  StaticAnalysisService,
} from "./StaticAnalysisService.js";

export class ValidationService {
  /**
   * Static integrity check using NLP libraries to detect structural failures.
   */
  static async checkIntegrity(
    filePath: string,
    expectedPersonaId: string,
    expectedLanguage: string,
  ): Promise<{ isValid: boolean; issues: string[] }> {
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

    return { isValid: issues.length === 0, issues };
  }

  /**
   * Orchestrates a multi-pass audit using a working copy in .hub/tmp.
   */
  static async runFullAudit(
    config: GlobalConfig,
    client: GoogleGenAI,
    filePath: string,
    auditor: Auditor,
  ): Promise<{
    report: AuditResult;
    allIssues: AuditIssue[];
    workingFile: string;
    staticReport: FullAuditReport;
  }> {
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
    const artifacts = await RegistryService.getAllArtifacts();
    const agents = RegistryService.initializeAgents(config, client, artifacts);
    const persona = RegistryService.getAgentsByType(agents, "persona").find(
      (p) => p.artifact.id === parsed.frontmatter.personaId,
    );

    if (!persona) throw new Error("Persona not found.");

    const staticReport = StaticAnalysisService.analyze(
      rawContent,
      parsed.frontmatter.language,
    );
    const allIssues: AuditIssue[] = [];

    // Section Pass
    for (const sectionData of staticReport.sections) {
      const result = await auditor.analyze(
        {
          title: parsed.frontmatter.title!,
          goal: parsed.frontmatter.goal!,
          blueprint: JSON.stringify(
            parsed.frontmatter.blueprint || {},
            null,
            2,
          ),
          staticAnalysis: JSON.stringify(sectionData || {}, null, 2),
        },
        parsed.sections[sectionData.header],
        persona.agent,
        "section",
      );
      allIssues.push(...result.issues);
    }

    // Global Pass
    const globalResult = await auditor.analyze(
      {
        title: parsed.frontmatter.title!,
        goal: parsed.frontmatter.goal!,
        blueprint: JSON.stringify(parsed.frontmatter.blueprint || {}, null, 2),
        staticAnalysis: JSON.stringify(staticReport.global || {}, null, 2),
      },
      rawContent,
      persona.agent,
      "global",
    );
    allIssues.push(...globalResult.issues);

    return { report: globalResult, allIssues, workingFile, staticReport };
  }

  /**
   * Surgical fix on the working copy with atomic verification.
   */
  static async verifyAndFix(
    config: GlobalConfig,
    client: GoogleGenAI,
    workingFilePath: string,
    sectionName: string,
    issues: AuditIssue[],
    auditor: Auditor,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const rawContent = await fs.readFile(workingFilePath, "utf-8");
      const parsed = ParserService.parseMarkdown(rawContent);
      const artifacts = await RegistryService.getAllArtifacts();
      const agents = RegistryService.initializeAgents(
        config,
        client,
        artifacts,
      );

      const sectionHeaders = Object.keys(parsed.sections);
      const sectionIndex = sectionHeaders.indexOf(sectionName);

      const writerId =
        (parsed.frontmatter.blueprint as any)?.[sectionName]?.writerId ||
        "prose";
      const writer = RegistryService.getAgentsByType(agents, "writer").find(
        (w) => w.artifact.id === writerId,
      );
      const persona = RegistryService.getAgentsByType(agents, "persona").find(
        (p) => p.artifact.id === parsed.frontmatter.personaId,
      );

      if (!writer || !persona)
        throw new Error(`Missing agents for ${sectionName}`);

      const bridges = (parsed.frontmatter as any).bridges || {};
      const precedingBridge =
        sectionIndex > 0
          ? bridges[sectionHeaders[sectionIndex - 1]]
          : undefined;

      const combinedInstructions = issues
        .map(
          (i) =>
            `- [${i.type.toUpperCase()}]: ${i.message}. Suggestion: ${i.suggestion}`,
        )
        .join("\n");

      const response = await writer.agent.write({
        header: sectionName,
        intent: `REFINE AND FIX THE FOLLOWING ISSUES:\n${combinedInstructions}`,
        topic: parsed.frontmatter.title,
        goal: parsed.frontmatter.goal || "",
        audience: parsed.frontmatter.audience || "",
        language: parsed.frontmatter.language,
        persona: persona.agent,
        precedingBridge:
          sectionIndex > 0
            ? (parsed.frontmatter as any).bridges?.[
                sectionHeaders[sectionIndex - 1]
              ]
            : undefined,
        isFirst: sectionIndex === 0,
        isLast: sectionIndex === sectionHeaders.length - 1,
      });

      const updatedSections = {
        ...parsed.sections,
        [sectionName]: response.content,
      };
      const updatedBridges = { ...bridges, [sectionName]: response.bridge };
      const candidateContent = ParserService.reconstructMarkdown(
        { ...parsed.frontmatter, bridges: updatedBridges },
        updatedSections,
      );

      // Verify the candidate fix
      const staticReport = StaticAnalysisService.analyze(
        candidateContent,
        parsed.frontmatter.language,
      );
      const verification = await auditor.analyze(
        {
          title: parsed.frontmatter.title!,
          goal: parsed.frontmatter.goal!,
          blueprint: JSON.stringify(
            parsed.frontmatter.blueprint || {},
            null,
            2,
          ),
          staticAnalysis: JSON.stringify(
            staticReport.sections.find((s) => s.header === sectionName) || {},
            null,
            2,
          ),
        },
        `## ${sectionName}\n\n${response.content}`,
        persona.agent,
        "section",
      );

      const remainingIssues = verification.issues;

      // If the Auditor returns ANY issues for this section after the fix,
      // we consider the fix "unsuccessful" in terms of reaching 'Perfect' state.
      if (remainingIssues.length > 0) {
        // We provide the NEW messages from the Auditor so the user knows
        // exactly what the state of the prose is NOW.
        return {
          success: false,
          message: remainingIssues
            .map((i) => `${i.message} (${i.severity})`)
            .join("; "),
        };
      }

      await fs.writeFile(workingFilePath, candidateContent, "utf-8");
      return { success: true, message: "Working copy updated." };
    } catch (error) {
      return { success: false, message: "Surgical fix failed." };
    }
  }

  static async finalize(
    workingFile: string,
    originalFile: string,
  ): Promise<void> {
    await fs.rename(workingFile, originalFile);
  }
}

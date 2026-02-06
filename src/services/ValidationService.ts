// src/services/ValidationService.ts
import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises";
import { AuditIssue, Auditor, AuditResult } from "../agents/Auditor.js";
import { GlobalConfig } from "../utils/config.js";
import { IoService } from "./IoService.js";
import { ParserService } from "./ParserService.js";
import { RegistryService } from "./RegistryService.js";
import { StaticAnalysisService } from "./StaticAnalysisService.js";

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
   * Reusable Orchestrator for the Multi-Pass Audit process.
   * Can be called by 'audit', 'new', or 'spawn' commands.
   */
  static async runFullAudit(
    config: GlobalConfig,
    client: GoogleGenAI,
    filePath: string,
    auditor: Auditor,
  ): Promise<{ report: AuditResult; allIssues: AuditIssue[] }> {
    const rawContent = await fs.readFile(filePath, "utf-8");
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

    // 1. Section Pass (Isolated Contexts)
    for (const sectionData of staticReport.sections) {
      const sectionContent = parsed.sections[sectionData.header];
      const result = await auditor.analyze(
        sectionContent,
        parsed.frontmatter,
        persona.agent,
        "section",
        sectionData,
      );
      allIssues.push(...result.issues);
    }

    // 2. Global Pass (Cohesion)
    const globalResult = await auditor.analyze(
      rawContent,
      parsed.frontmatter,
      persona.agent,
      "global",
      staticReport.global,
    );
    allIssues.push(...globalResult.issues);

    return {
      report: globalResult, // Returns the final global consolidation
      allIssues,
    };
  }

  /**
   * Surgical fix and verification loop with bridge preservation.
   */
  static async verifyAndFix(
    config: GlobalConfig,
    client: GoogleGenAI,
    filePath: string,
    issue: AuditIssue,
    auditor: Auditor,
  ): Promise<{ success: boolean; message: string }> {
    const rawContent = await fs.readFile(filePath, "utf-8");
    const parsed = ParserService.parseMarkdown(rawContent);
    const artifacts = await RegistryService.getAllArtifacts();
    const agents = RegistryService.initializeAgents(config, client, artifacts);
    const sectionHeaders = Object.keys(parsed.sections);
    const sectionIndex = sectionHeaders.indexOf(issue.section);

    const writerId =
      (parsed.frontmatter.blueprint as any)?.[issue.section]?.writerId ||
      "prose";
    const writerPair = RegistryService.getAgentsByType(agents, "writer").find(
      (w) => w.artifact.id === writerId,
    );
    const personaPair = RegistryService.getAgentsByType(agents, "persona").find(
      (p) => p.artifact.id === parsed.frontmatter.personaId,
    );

    if (!writerPair || !personaPair) throw new Error("Missing agents for fix.");

    const bridges = (parsed.frontmatter as any).bridges || {};
    const prevHeader = sectionHeaders[sectionIndex - 1];
    const precedingBridge = prevHeader ? bridges[prevHeader] : undefined;

    const upcomingIntents = sectionHeaders
      .slice(sectionIndex + 1)
      .map(
        (h) =>
          `[${h}]: ${(parsed.frontmatter.blueprint as any)?.[h]?.intent || "Next topic"}`,
      );

    const response = await writerPair.agent.write({
      header: issue.section,
      intent: `FIXING AUDIT ISSUE: ${issue.message}\nSUGGESTION: ${issue.suggestion}`,
      topic: parsed.frontmatter.title,
      goal: parsed.frontmatter.goal || "",
      audience: parsed.frontmatter.audience || "",
      language: parsed.frontmatter.language,
      persona: personaPair.agent,
      precedingBridge,
      upcomingIntents,
      isFirst: sectionIndex === 0,
      isLast: sectionIndex === sectionHeaders.length - 1,
    });

    const verificationContent = `## ${issue.section}\n\n${response.content}`;
    const staticReport = StaticAnalysisService.analyze(
      verificationContent,
      parsed.frontmatter.language,
    );

    const verification = await auditor.analyze(
      verificationContent,
      parsed.frontmatter,
      personaPair.agent,
      "section",
      staticReport.sections[0],
    );

    if (
      verification.issues.find(
        (i) => i.section === issue.section && i.type === issue.type,
      )
    ) {
      return { success: false, message: "Fix rejected: Issue persists." };
    }

    const updatedSections = {
      ...parsed.sections,
      [issue.section]: response.content,
    };
    const updatedBridges = { ...bridges, [issue.section]: response.bridge };

    const finalMarkdown = ParserService.reconstructMarkdown(
      { ...parsed.frontmatter, bridges: updatedBridges },
      updatedSections,
    );
    await IoService.safeWriteFile(filePath, finalMarkdown);

    return { success: true, message: "Verified and merged." };
  }
}

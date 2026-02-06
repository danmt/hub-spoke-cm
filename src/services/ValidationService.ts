// src/services/ValidationService.ts
import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises";
import { AuditIssue, Auditor, AuditResult } from "../agents/Auditor.js";
import { GlobalConfig } from "../utils/config.js";
import { IoService } from "./IoService.js";
import { ParserService } from "./ParserService.js";
import { RegistryService } from "./RegistryService.js";

export class ValidationService {
  static async checkIntegrity(
    filePath: string,
    expectedPersonaId: string,
    expectedLanguage: string,
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const content = await fs.readFile(filePath, "utf-8");
    const { frontmatter, sections } = ParserService.parseMarkdown(content);
    const issues: string[] = [];

    if (frontmatter.personaId !== expectedPersonaId)
      issues.push("Persona Drift.");
    if (frontmatter.language !== expectedLanguage)
      issues.push("Language Mismatch.");

    const pending = Object.entries(sections).filter(
      ([_, b]) => b.includes("TODO:") || b.trim().length < 50,
    );
    pending.forEach(([h]) => issues.push(`Pending Content: "${h}"`));

    return { isValid: issues.length === 0, issues };
  }

  static async runAudit(
    config: GlobalConfig,
    client: GoogleGenAI,
    filePath: string,
    auditor: Auditor,
  ): Promise<AuditResult> {
    const rawContent = await fs.readFile(filePath, "utf-8");
    const parsed = ParserService.parseMarkdown(rawContent);
    const artifacts = await RegistryService.getAllArtifacts();
    const agents = RegistryService.initializeAgents(config, client, artifacts);
    const persona = RegistryService.getAgentsByType(agents, "persona").find(
      (p) => p.artifact.id === parsed.frontmatter.personaId,
    );

    if (!persona) throw new Error("Persona not found.");
    return await auditor.analyze(rawContent, parsed.frontmatter, persona.agent);
  }

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
    const writer = RegistryService.getAgentsByType(agents, "writer").find(
      (w) => w.artifact.id === writerId,
    );
    const persona = RegistryService.getAgentsByType(agents, "persona").find(
      (p) => p.artifact.id === parsed.frontmatter.personaId,
    );

    if (!writer || !persona) throw new Error("Missing agents for fix.");

    // Access persisted bridge context
    const bridges = (parsed.frontmatter as any).bridges || {};
    const prevHeader = sectionHeaders[sectionIndex - 1];
    const precedingBridge = prevHeader ? bridges[prevHeader] : undefined;

    const upcomingIntents = sectionHeaders
      .slice(sectionIndex + 1)
      .map(
        (h) =>
          `[${h}]: ${(parsed.frontmatter.blueprint as any)?.[h]?.intent || "Next topic"}`,
      );

    const response = await writer.agent.write({
      header: issue.section,
      intent: `FIX SUGGESTION: ${issue.suggestion}\nISSUE: ${issue.message}\nORIGINAL INTENT: ${(parsed.frontmatter.blueprint as any)?.[issue.section]?.intent}`,
      topic: parsed.frontmatter.title,
      goal: parsed.frontmatter.goal || "",
      audience: parsed.frontmatter.audience || "",
      language: parsed.frontmatter.language,
      persona: persona.agent,
      precedingBridge,
      upcomingIntents,
      isFirst: sectionIndex === 0,
      isLast: sectionIndex === sectionHeaders.length - 1,
    });

    const verification = await auditor.analyze(
      `## ${issue.section}\n\n${response.content}`,
      parsed.frontmatter,
      persona.agent,
    );

    if (
      verification.issues.find(
        (i) => i.section === issue.section && i.type === issue.type,
      )
    ) {
      return { success: false, message: "Fix rejected: Issue persists." };
    }

    // Merge content and update the bridge for subsequent sections
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

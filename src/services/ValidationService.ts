import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises";
import { AuditIssue, Auditor, AuditResult } from "../agents/Auditor.js";
import { GlobalConfig } from "../utils/config.js";
import { IoService } from "./IoService.js";
import { ParserService } from "./ParserService.js";
import { RegistryService } from "./RegistryService.js";

export class ValidationService {
  /**
   * Phase 1: Structural Integrity (Static Check)
   */
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

  /**
   * Phase 2: Semantic Audit (AI Analysis)
   */
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

  /**
   * Phase 3: Verified Fix (Surgical Refactoring)
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

    // Generate Candidate
    const candidate = await writer.agent.write({
      header: issue.section,
      intent: `FIX SUGGESTION: ${issue.suggestion}\nISSUE: ${issue.message}\nORIGINAL INTENT: ${(parsed.frontmatter.blueprint as any)?.[issue.section]?.intent}`,
      topic: parsed.frontmatter.title,
      goal: parsed.frontmatter.goal || "",
      audience: parsed.frontmatter.audience || "",
      language: parsed.frontmatter.language,
      persona: persona.agent,
    });

    // Verify Candidate
    const verification = await auditor.analyze(
      `## ${issue.section}\n\n${candidate}`,
      parsed.frontmatter,
      persona.agent,
    );
    if (
      verification.issues.find(
        (i) => i.section === issue.section && i.type === issue.type,
      )
    ) {
      return {
        success: false,
        message: "Fix rejected: Issue persists in candidate.",
      };
    }

    // Surgical Merge
    const updatedSections = { ...parsed.sections, [issue.section]: candidate };
    const finalMarkdown = ParserService.reconstructMarkdown(
      parsed.frontmatter,
      updatedSections,
    );
    await IoService.safeWriteFile(filePath, finalMarkdown);

    return { success: true, message: "Verified and merged." };
  }
}

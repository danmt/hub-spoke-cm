// src/agents/Auditor.ts
import { AiService } from "../services/AiService.js";
import { getGlobalConfig } from "../utils/config.js";
import { Persona } from "./Persona.js";

export interface AuditIssue {
  section: string;
  type:
    | "structure"
    | "cohesion"
    | "duplication"
    | "intent_drift"
    | "readability";
  severity: "low" | "medium" | "high";
  message: string;
  suggestion: string;
}

export interface AuditorResponse {
  passed: boolean;
  issues: AuditIssue[];
  summary: string;
}

export interface AuditorContext {
  title: string;
  goal: string;
  blueprint: string;
  staticAnalysis: string;
  content: string;
  persona: Persona;
  scope: "section" | "global";
  onRetry?: (error: Error) => Promise<boolean>;
}

export class Auditor {
  constructor(
    public id: string,
    public description: string,
    public auditStrategy: string,
  ) {}

  async audit(ctx: AuditorContext): Promise<AuditorResponse> {
    const modelName = getGlobalConfig().architectModel || "gemini-2.0-flash";

    const systemInstruction = `
      You are a Content Auditor. 
      Strategy: ${this.auditStrategy}

      PROJECT CONTEXT:
      Topic: ${ctx.title} | Goal: ${ctx.goal}
      
      ORIGINAL BLUEPRINT:
      ${ctx.blueprint}

      Persona Context: ${ctx.persona.name} (${ctx.persona.tone})

      Audit Scope: ${ctx.scope.toUpperCase()}

      STATIC ANALYSIS DATA:
      ${ctx.staticAnalysis}

      TASK:
      Audit the content. Flag drift, duplication, or poor cohesion.
      If scope is "section", focus only on that section's specific intent.
      If scope is "global", focus on the flow and overall consistency.

      OUTPUT FORMAT (Strict Delimiters):
      [PASSED]true|false[/PASSED]
      [SUMMARY]General assessment summary[/SUMMARY]
      
      [ISSUE]
      [SECTION]Header Name[/SECTION]
      [TYPE]structure|cohesion|duplication|intent_drift|readability[/TYPE]
      [SEVERITY]low|medium|high[/SEVERITY]
      [MESSAGE]Description of the issue[/MESSAGE]
      [SUGGESTION]Specific fix or improvement[/SUGGESTION]
      [/ISSUE]
    `;

    const text = await AiService.execute(ctx.content, {
      model: modelName,
      systemInstruction,
      onRetry: ctx.onRetry,
    });

    const issues: AuditIssue[] = [];
    const issueRegex = /\[ISSUE\]([\s\S]*?)\[\/ISSUE\]/gi;
    let match;

    while ((match = issueRegex.exec(text)) !== null) {
      const block = match[1];
      issues.push({
        section:
          block.match(/\[SECTION\](.*?)\[\/SECTION\]/i)?.[1].trim() ||
          "Unknown",
        type:
          (block.match(/\[TYPE\](.*?)\[\/TYPE\]/i)?.[1].trim() as any) ||
          "readability",
        severity:
          (block
            .match(/\[SEVERITY\](.*?)\[\/SEVERITY\]/i)?.[1]
            .trim() as any) || "low",
        message:
          block.match(/\[MESSAGE\](.*?)\[\/MESSAGE\]/i)?.[1].trim() || "",
        suggestion:
          block
            .match(/\[SUGGESTION\]([\s\S]*?)\[\/SUGGESTION\]/i)?.[1]
            .trim() || "",
      });
    }

    return {
      passed:
        text
          .match(/\[PASSED\](.*?)\[\/PASSED\]/i)?.[1]
          .trim()
          .toLowerCase() === "true",
      summary: text.match(/\[SUMMARY\](.*?)\[\/SUMMARY\]/i)?.[1].trim() || "",
      issues,
    };
  }
}

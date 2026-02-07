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

export interface IAuditor {
  id: string;
  description: string;
  auditStrategy: string;
  analyze(ctx: AuditorContext): Promise<AuditorResponse>;
}

export class Auditor {
  constructor(
    public id: string,
    public description: string,
    public auditStrategy: string,
  ) {}

  async analyze(ctx: AuditorContext): Promise<AuditorResponse> {
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
      Analyze the provided content. Flag drift, duplication, or poor cohesion.
      If scope is "section", focus only on that section's specific intent.
      If scope is "global", focus on the flow and overall consistency.

      OUTPUT FORMAT (RAW JSON ONLY):
      {
        "passed": boolean,
        "summary": "assessment",
        "issues": [
          { "section": "header", "type": "...", "severity": "...", "message": "...", "suggestion": "..." }
        ]
      }
    `;

    const text = await AiService.execute(ctx.content, {
      model: modelName,
      systemInstruction,
      isJson: true,
      onRetry: ctx.onRetry,
    });

    return JSON.parse(text ?? "{}") as AuditorResponse;
  }
}

// src/agents/Auditor.ts
import { GoogleGenAI } from "@google/genai";
import { GlobalConfig } from "../utils/config.js";
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

export interface AuditResult {
  passed: boolean;
  issues: AuditIssue[];
  summary: string;
}

export interface AuditContext {
  title: string;
  goal: string;
  blueprint: string;
  staticAnalysis: string;
}

export class Auditor {
  constructor(
    private client: GoogleGenAI,
    private config: GlobalConfig,
    public id: string,
    public description: string,
    public auditStrategy: string,
  ) {}

  async analyze(
    ctx: AuditContext,
    content: string,
    persona: Persona,
    scope: "section" | "global",
  ): Promise<AuditResult> {
    const modelName = this.config.architectModel || "gemini-3-flash";

    const systemInstruction = `
      You are a Content Auditor. 
      Strategy: ${this.auditStrategy}

      PROJECT CONTEXT:
      Topic: ${ctx.title} | Goal: ${ctx.goal}
      
      ORIGINAL BLUEPRINT:
      ${ctx.blueprint}

      Persona Context: ${persona.name} (${persona.tone})

      Audit Scope: ${scope.toUpperCase()}

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

    const result = await this.client.models.generateContent({
      model: modelName,
      config: {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        responseMimeType: "application/json",
      },
      contents: [{ role: "user", parts: [{ text: content }] }],
    });

    return JSON.parse(result.text ?? "{}") as AuditResult;
  }
}

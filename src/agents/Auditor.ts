import { GoogleGenAI } from "@google/genai";
import { GlobalConfig } from "../utils/config.js";
import { Persona } from "./Persona.js";

export interface AuditIssue {
  section: string;
  type: "structure" | "cohesion" | "duplication" | "intent_drift";
  severity: "low" | "medium" | "high";
  message: string;
  suggestion: string;
}

export interface AuditResult {
  passed: boolean;
  issues: AuditIssue[];
  summary: string;
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
    content: string,
    context: any,
    persona: Persona,
  ): Promise<AuditResult> {
    const modelName = this.config.architectModel || "gemini-2.0-flash";

    const systemInstruction = `
      You are a Senior Content Auditor. 
      Strategy: ${this.auditStrategy}

      PROJECT CONTEXT:
      Topic: ${context.title} | Goal: ${context.goal}
      Persona: ${persona.name}
      
      ORIGINAL BLUEPRINT:
      ${JSON.stringify(context.blueprint || {}, null, 2)}

      TASK:
      Analyze the content against the Goal and original Blueprint. 
      Flag drift, duplication, or poor cohesion.

      OUTPUT FORMAT (RAW JSON ONLY):
      {
        "passed": boolean,
        "summary": "Overall assessment",
        "issues": [
          { "section": "Name", "type": "intent_drift", "severity": "high", "message": "...", "suggestion": "..." }
        ]
      }
    `;

    const result = await this.client.models.generateContent({
      model: modelName,
      config: { systemInstruction: { parts: [{ text: systemInstruction }] } },
      contents: [
        { role: "user", parts: [{ text: `Audit content:\n\n${content}` }] },
      ],
    });

    const rawJson = (result.text ?? "").replace(/```json|```/g, "").trim();
    return JSON.parse(rawJson) as AuditResult;
  }
}

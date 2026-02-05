import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { HubBlueprint, SectionBlueprint } from "../types/index.js";
import { getGlobalConfig } from "../utils/config.js";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY || getGlobalConfig().apiKey;

if (!API_KEY) {
  throw new Error(
    "Gemini API Key not found.\n" +
      "Please run: hub config set-key <your-api-key>\n" +
      "Or set GEMINI_API_KEY in your environment.",
  );
}

const genAI = new GoogleGenAI({ apiKey: API_KEY });

function getModelName(role: "architect" | "writer"): string {
  const config = getGlobalConfig();
  return role === "architect"
    ? config.architectModel || "gemini-3-flash-preview"
    : config.writerModel || "gemini-3-flash-preview";
}

/**
 * [ARCHITECT TASK]
 * Generates the structural blueprint for a new Hub.
 */
export async function generateAnatomy(
  topic: string,
  goal: string,
  audience: string,
  language: string,
): Promise<HubBlueprint> {
  const modelName = getModelName("architect");

  const prompt = `
    You are an expert Technical Content Strategist. 
    Design a comprehensive content "Hub" structure.
    
    - **Topic**: ${topic}
    - **Goal**: ${goal}
    - **Target Audience**: ${audience}
    - **Output Language**: ${language} (IMPORTANT: All headers and intents must be in this language)
    
    Output a strictly valid JSON object matching this schema:
    {
      "hubId": "kebab-case-slug-of-topic",
      "components": [
        { 
          "id": "short-slug", 
          "header": "Exact Header Text (H2)", 
          "intent": "Specific instructions for what to write in this section" 
        }
      ]
    }
  `;

  try {
    const response = await genAI.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");

    return JSON.parse(text) as HubBlueprint;
  } catch (error) {
    throw new Error(
      `AI Anatomy generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * [ARCHITECT TASK]
 * Generates a detailed outline for a Spoke article.
 */
export async function generateSpokeStructure(
  title: string,
  hubGoal: string,
  context: string,
  language: string,
): Promise<SectionBlueprint[]> {
  const modelName = getModelName("architect");

  const prompt = `
    You are an expert technical editor. Create a content outline for a satellite article ("Spoke").
    
    - **Article Title**: "${title}"
    - **Parent Hub Goal**: "${hubGoal}"
    - **Context**: "${context}"
    - **Language**: ${language}
    
    Output strictly a JSON array of objects matching this shape:
    [ 
      { "header": "Section Title", "intent": "Instruction on what to cover" } 
    ]
    
    Do not include the Intro or Conclusion in this list. Focus on the body sections.
  `;

  try {
    const response = await genAI.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");

    return JSON.parse(text) as SectionBlueprint[];
  } catch (error) {
    return [
      { header: "Overview", intent: "Explain the core concept" },
      { header: "Implementation", intent: "Provide examples and code" },
    ];
  }
}

/**
 * [WRITER TASK]
 * Generates prose content for a specific section.
 */
export async function generateContent(
  hubGoal: string,
  componentHeader: string,
  componentIntent: string,
  language: string,
  surroundingContext: string = "",
): Promise<string> {
  const modelName = getModelName("writer");

  const prompt = `
    You are a technical writer drafting a specific section of a guide.
    
    **Context**:
    - **Overall Guide Goal**: ${hubGoal}
    - **Current Section Header (H2)**: "${componentHeader}"
    - **Section Intent**: ${componentIntent}
    - **Language**: ${language} (Write strictly in this language)
    
    **Instructions**:
    - Write the content for ONLY this section.
    - **HIERARCHY RULE**: The current section is already an H2. Any subsections you create MUST be H3 ('###') or deeper. Do NOT use H1 or H2.
    - Do not repeat the main header itself.
    - Use technical, clear, and concise language.
    - Use Markdown formatting (code blocks, bolding, lists).
    ${surroundingContext ? `- Ensure flow with context: \n"${surroundingContext}"` : ""}
  `;

  try {
    const response = await genAI.models.generateContent({
      model: modelName,
      contents: prompt,
    });

    return response.text?.trim() || "";
  } catch (error) {
    throw new Error(
      `AI Content generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

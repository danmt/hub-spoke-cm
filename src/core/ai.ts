import { GenerationConfig, GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { HubBlueprint, SectionBlueprint } from "../types/index.js";
import { getGlobalConfig } from "../utils/config.js";

// Load environment variables (local .env)
dotenv.config();

// 1. Resolve API Key
const API_KEY = process.env.GEMINI_API_KEY || getGlobalConfig().apiKey;

if (!API_KEY) {
  throw new Error(
    "Gemini API Key not found.\n" +
      "Please run: hub config set-key <your-api-key>\n" +
      "Or set GEMINI_API_KEY in your environment.",
  );
}

const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Helper to get the correct model instance based on the task type.
 * - Architect: High reasoning (Structure, JSON, Logic)
 * - Writer: High speed/volume (Prose, Markdown)
 */
function getModel(role: "architect" | "writer") {
  const config = getGlobalConfig();

  // Defaults are handled in config.ts, but we add a fallback here just in case
  const modelName =
    role === "architect"
      ? config.architectModel || "gemini-3-flash-preview"
      : config.writerModel || "gemini-3-flash-preview";

  return genAI.getGenerativeModel({ model: modelName });
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
  const model = getModel("architect"); // <--- Uses Architect Model

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
    const generationConfig: GenerationConfig = {
      responseMimeType: "application/json",
    } as any;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    return JSON.parse(result.response.text()) as HubBlueprint;
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
  const model = getModel("architect"); // <--- Uses Architect Model

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
    const generationConfig: GenerationConfig = {
      responseMimeType: "application/json",
    } as any;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    return JSON.parse(result.response.text()) as SectionBlueprint[];
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
  const model = getModel("writer"); // <--- Uses Writer Model

  const prompt = `
    You are a technical writer drafting a specific section of a guide.
    
    **Context**:
    - **Overall Guide Goal**: ${hubGoal}
    - **Current Section Header**: "${componentHeader}"
    - **Section Intent**: ${componentIntent}
    - **Language**: ${language} (Write strictly in this language)
    
    **Instructions**:
    - Write the content for ONLY this section.
    - Do not include the header itself (it already exists).
    - Use technical, clear, and concise language.
    - Use Markdown formatting (code blocks, bolding, lists).
    ${surroundingContext ? `- Ensure flow with context: \n"${surroundingContext}"` : ""}
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    throw new Error(
      `AI Content generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * [WRITER TASK]
 * Batch Generates content for multiple sections in a SINGLE request.
 */
export async function generateBatchContent(
  hubGoal: string,
  sections: { header: string; intent: string }[],
  language: string,
): Promise<Record<string, string>> {
  const model = getModel("writer"); // <--- Uses Writer Model

  const sectionsList = sections
    .map((s) => `- Header: "${s.header}"\n  Intent: ${s.intent}`)
    .join("\n");

  const prompt = `
    You are a technical writer. Write content for the following ${sections.length} sections of a guide.
    
    **Context**:
    - **Overall Guide Goal**: ${hubGoal}
    - **Language**: ${language}
    
    **Sections to Write**:
    ${sectionsList}
    
    **Instructions**:
    - Output a strictly valid JSON object.
    - Keys must be the EXACT Header text provided above.
    - Values must be the Markdown content for that section.
    - Do not include the header text inside the value (just the body).
    
    Example Output:
    {
      "Header Name": "Content for this section...",
      "Another Header": "Content for that section..."
    }
  `;

  try {
    const generationConfig: GenerationConfig = {
      responseMimeType: "application/json",
    } as any;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    return JSON.parse(result.response.text()) as Record<string, string>;
  } catch (error) {
    throw new Error(
      `Batch generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

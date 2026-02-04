import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
// Explicit .js extension for NodeNext compatibility
import { HubAnatomy } from "../types/index.js";
import { getGlobalConfig } from "../utils/config.js";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY || getGlobalConfig().apiKey;

if (!API_KEY) {
  // We throw a helpful error telling them how to fix it
  throw new Error(
    "Gemini API Key not found.\n" +
      "Please run: hub config set-key <your-api-key>\n" +
      "Or set GEMINI_API_KEY in your environment.",
  );
}

const genAI = new GoogleGenerativeAI(API_KEY);

// We use a model that supports JSON mode well
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

/**
 * Generates the structural blueprint (Anatomy) for a new Hub.
 * Ref: SRS REQ-4.1.3
 */
export async function generateAnatomy(
  topic: string,
  goal: string,
  audience: string,
): Promise<HubAnatomy> {
  const prompt = `
    You are an expert Technical Content Strategist. 
    Design a comprehensive content "Hub" structure for the following project:
    
    - **Topic**: ${topic}
    - **Goal**: ${goal}
    - **Target Audience**: ${audience}
    
    Output a strictly valid JSON object. 
    The structure must act as a logical table of contents using H2 or H3 headers.
    Each component must have:
    1. 'id': A short, unique slug (e.g., 'setup', 'deep-dive').
    2. 'header': The exact header text (e.g., 'Setting up the Environment').
    3. 'intent': Instructions for the writer/AI on what this section should cover.

    The JSON must match this schema:
    {
      "hubId": "kebab-case-slug-of-topic",
      "goal": "${goal}",
      "targetAudience": "${audience}",
      "components": [
        { "id": "string", "header": "string", "intent": "string" }
      ]
    }
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json", // Force JSON output
      },
    });

    const responseText = result.response.text();
    return JSON.parse(responseText) as HubAnatomy;
  } catch (error) {
    throw new Error(
      `AI Anatomy generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Generates prose content for a specific section of the Hub.
 * Ref: SRS REQ-4.3.1
 */
export async function generateContent(
  hubGoal: string,
  componentHeader: string,
  componentIntent: string,
  surroundingContext: string = "",
): Promise<string> {
  const prompt = `
    You are a technical writer drafting a specific section of a guide.
    
    **Context**:
    - **Overall Guide Goal**: ${hubGoal}
    - **Current Section Header**: "${componentHeader}"
    - **Section Intent**: ${componentIntent}
    
    **Instructions**:
    - Write the content for ONLY this section.
    - Do not include the header itself (it already exists).
    - Use technical, clear, and concise language.
    - Use Markdown formatting (lists, code blocks, bolding) where appropriate.
    ${surroundingContext ? `- Ensure flow with the following surrounding context: \n"${surroundingContext}"` : ""}
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

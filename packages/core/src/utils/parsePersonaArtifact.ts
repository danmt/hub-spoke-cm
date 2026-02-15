import { parseFrontmatter } from "./parseFrontmatter.js";

export function parsePersonaArtifact(raw: string) {
  const { data, content } = parseFrontmatter(raw);
  return {
    id: data.id,
    name: data.name,
    description: data.description || "",
    language: data.language || "English",
    tone: data.tone || "Neutral",
    accent: data.accent || "Standard",
    model: data.model,
    content: content.trim(),
  };
}

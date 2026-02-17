import { parseFrontmatter } from "./parseFrontmatter.js";

export function parseWriterArtifact(raw: string) {
  const { data, content } = parseFrontmatter(raw);
  return {
    id: data.id,
    description: data.description || "",
    model: data.model,
    content: content.trim(),
  };
}

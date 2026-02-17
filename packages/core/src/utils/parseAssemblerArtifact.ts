import { parseFrontmatter } from "./parseFrontmatter.js";

export function parseAssemblerArtifact(raw: string) {
  const { data, content } = parseFrontmatter(raw);

  // Specific list parsing for writerIds
  let writerIds: string[] = [];
  if (Array.isArray(data.writerIds)) {
    writerIds = data.writerIds;
  } else if (
    typeof data.writerIds === "string" &&
    data.writerIds.trim().length > 0
  ) {
    writerIds = data.writerIds
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
  }

  return {
    id: data.id,
    description: data.description || "",
    writerIds,
    model: data.model,
    content: content.trim(),
  };
}

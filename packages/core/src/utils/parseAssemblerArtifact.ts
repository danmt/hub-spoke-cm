import { parseFrontmatter } from "./parseFrontmatter.js";

export function parseAssemblerArtifact(raw: string) {
  console.log(`parseAssemblerArtifact [content]: \n ${raw}\n`);

  const { data, content } = parseFrontmatter(raw);

  console.log(
    `parseAssemblerArtifact [data]: \n ${JSON.stringify(data, null, 2)} \n `,
  );
  console.log(
    `parseAssemblerArtifact [data.writerIds]: \n  ${JSON.stringify(data.writerIds, null, 2)}\n `,
  );

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

  console.log(
    `parseAssemblerArtifact [output]: \n  ${JSON.stringify(
      {
        id: data.id,
        description: data.description || "",
        writerIds,
        model: data.model,
        content: content.trim(),
      },
      null,
      2,
    )}\n `,
  );

  return {
    id: data.id,
    description: data.description || "",
    writerIds,
    model: data.model,
    content: content.trim(),
  };
}

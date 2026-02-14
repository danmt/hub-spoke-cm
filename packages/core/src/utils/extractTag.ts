export function extractTag(block: string, tagName: string): string | null {
  const regex = new RegExp(
    `\\[${tagName}\\]([\\s\\S]*?)\\[\\/${tagName}\\]`,
    "i",
  );
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}

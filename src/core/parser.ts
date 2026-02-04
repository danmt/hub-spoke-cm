import matter from "gray-matter";
// Explicit .js extension required for NodeNext resolution
import { ContentFrontmatter, FrontmatterSchema } from "../types/index.js";

export interface ParsedFile {
  frontmatter: ContentFrontmatter;
  content: string; // The raw body without frontmatter
  sections: Record<string, string>; // Map of "Header Text" -> "Section Content"
}

/**
 * Parses a markdown string into frontmatter and split sections.
 */
export function parseMarkdown(rawContent: string): ParsedFile {
  const { data, content } = matter(rawContent);

  // Validate frontmatter
  const parsedFrontmatter = FrontmatterSchema.passthrough().parse(data);

  // Parse Sections
  const sections = splitSections(content);

  return {
    frontmatter: parsedFrontmatter as ContentFrontmatter,
    content: content.trim(),
    sections,
  };
}

/**
 * Splits markdown content by H2 (##) and H3 (###) headers.
 * Uses a robust match-and-slice approach to avoid regex lookahead issues.
 */
function splitSections(markdownBody: string): Record<string, string> {
  const sections: Record<string, string> = {};

  // Regex to find headers only.
  // ^(#{2,3}) -> Starts with ## or ###
  // \s+       -> One or more spaces
  // (.*?)     -> Header text (Group 2)
  // \s*$      -> Optional trailing spaces, end of line
  const headerRegex = /^(#{2,3})\s+(.*?)\s*$/gm;

  let match;
  const matches: { key: string; index: number; end: number }[] = [];

  // 1. Find all header positions
  while ((match = headerRegex.exec(markdownBody)) !== null) {
    matches.push({
      key: match[2].trim(),
      index: match.index,
      end: match.index + match[0].length,
    });
  }

  // 2. Extract content between headers
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    // Content starts after the current header line
    const startSlice = current.end;

    // Content ends at the start of the next header, or end of string
    const endSlice = next ? next.index : markdownBody.length;

    const sectionContent = markdownBody.slice(startSlice, endSlice).trim();

    if (current.key) {
      sections[current.key] = sectionContent;
    }
  }

  return sections;
}

/**
 * Helper to reconstruct markdown from sections (for writing back to file).
 */
export function reconstructMarkdown(
  sections: Record<string, string>,
  order: string[],
): string {
  return order
    .map((header) => {
      const content = sections[header] || "";
      return `## ${header}\n\n${content}\n`;
    })
    .join("\n");
}

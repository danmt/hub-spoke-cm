// src/core/services/ParserService.ts
import matter from "gray-matter";
import { ContentFrontmatter, FrontmatterSchema } from "../../types/index.js";

export interface ParsedFile {
  frontmatter: ContentFrontmatter;
  sections: Record<string, string>;
}

export class ParserService {
  /**
   * Parses markdown into frontmatter and H2-based sections.
   */
  static parseMarkdown(rawContent: string): ParsedFile {
    const { data, content } = matter(rawContent);
    const frontmatter = FrontmatterSchema.passthrough().parse(
      data,
    ) as ContentFrontmatter;

    return {
      frontmatter,
      sections: this.splitSections(content),
    };
  }

  /**
   * Reconstructs the markdown file from parts.
   */
  static reconstructMarkdown(
    frontmatter: Record<string, any>,
    sections: Record<string, string>,
  ): string {
    const yamlLines = Object.entries(frontmatter).map(([k, v]) => {
      const value =
        typeof v === "object" ? JSON.stringify(v) : JSON.stringify(v);
      return `${k}: ${value}`;
    });

    const body = Object.entries(sections)
      .map(([header, content]) => `## ${header}\n\n${content}`)
      .join("\n\n");

    return `---\n${yamlLines.join("\n")}\n---\n\n${body}`;
  }

  private static splitSections(markdownBody: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const headerRegex = /^(#{2})\s+(.*?)\s*$/gm;
    let match;
    const matches: { key: string; index: number; end: number }[] = [];

    while ((match = headerRegex.exec(markdownBody)) !== null) {
      matches.push({
        key: match[2].trim(),
        index: match.index,
        end: match.index + match[0].length,
      });
    }

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];
      const startSlice = current.end;
      const endSlice = next ? next.index : markdownBody.length;
      sections[current.key] = markdownBody.slice(startSlice, endSlice).trim();
    }

    return sections;
  }
}

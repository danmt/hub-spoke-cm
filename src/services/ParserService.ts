// src/services/ParserService.ts
import matter from "gray-matter";
import { Brief } from "../agents/Architect.js";
import {
  ContentFrontmatter,
  FrontmatterSchema,
  HubBlueprint,
} from "../types/index.js";
import { LoggerService } from "./LoggerService.js";

export interface ParsedFile {
  frontmatter: ContentFrontmatter;
  sections: Record<string, string>;
  content: string;
}

export class ParserService {
  /**
   * Parses markdown into frontmatter and H2-based sections.
   */
  static parseMarkdown(rawContent: string): ParsedFile {
    try {
      const { data, content } = matter(rawContent);
      const frontmatter = FrontmatterSchema.passthrough().parse(
        data,
      ) as ContentFrontmatter;
      const sections = this.splitSections(content);

      LoggerService.debug("Markdown parsed successfully", {
        title: frontmatter.title,
        sectionCount: Object.keys(sections).length,
      });

      return { frontmatter, sections, content };
    } catch (err: any) {
      LoggerService.error("Markdown parsing failed", { error: err.message });
      throw err;
    }
  }

  /**
   * Reconstructs the markdown file from parts.
   */
  static reconstructMarkdown(
    frontmatter: Record<string, any>,
    sections: Record<string, string>,
  ): string {
    LoggerService.debug("Reconstructing markdown content");
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

  /**
   * Encapsulates the creation of a new Hub or Spoke scaffold.
   * Centralizes the template for TODO blocks and frontmatter mapping.
   */
  static generateScaffold(
    type: "hub" | "spoke",
    brief: Brief,
    blueprint: HubBlueprint,
    parentHubId?: string,
  ): string {
    const blueprintData: Record<string, any> = {};
    const writerMap: Record<string, string> = {};

    blueprint.components.forEach((c) => {
      blueprintData[c.header] = {
        intent: c.intent,
        writerId: c.writerId,
      };
      writerMap[c.header] = c.writerId;
    });

    const frontmatter: Partial<ContentFrontmatter> = {
      title: brief.topic,
      type: type,
      hubId: parentHubId || blueprint.hubId,
      goal: brief.goal,
      audience: brief.audience,
      language: brief.language,
      date: new Date().toISOString().split("T")[0],
      personaId: brief.personaId,
      blueprint: blueprintData,
      writerMap: writerMap,
      bridges: {},
    };

    // Add Spoke-specific metadata if applicable
    if (type === "spoke") {
      (frontmatter as any).componentId = blueprint.hubId;
    } else {
      (frontmatter as any).assemblerId = brief.assemblerId;
    }

    const sections: Record<string, string> = {};
    blueprint.components.forEach((c) => {
      sections[c.header] = `> **TODO:** ${c.intent}\n\n*Pending generation...*`;
    });

    // Reuse reconstruction logic for consistent YAML formatting
    const body = Object.entries(sections)
      .map(([header, content]) => `## ${header}\n\n${content}`)
      .join("\n\n");

    // Standardize YAML stringification
    const yaml = Object.entries(frontmatter)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join("\n");

    return `---\n${yaml}\n---\n\n# ${brief.topic}\n\n${body}`;
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

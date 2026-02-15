// src/services/ParserService.ts
import { Brief } from "../agents/Architect.js";
import {
  ContentFrontmatter,
  FrontmatterSchema,
  HubBlueprint,
} from "../types/index.js";
import { parseFrontmatter } from "../utils/parseFrontmatter.js";
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
      const { data, content } = parseFrontmatter(rawContent);
      const finalData: Record<string, any> = { ...data };

      if (data.blueprint) {
        try {
          finalData.blueprint = JSON.parse(data.blueprint);
        } catch {
          finalData.blueprint = {};
        }
      }

      const frontmatter = FrontmatterSchema.passthrough().parse(
        finalData,
      ) as ContentFrontmatter;
      const sections = this.extractSections(content);

      LoggerService.debug("Markdown parsed successfully via Bracket Sections", {
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
    LoggerService.debug(
      "Reconstructing markdown content with bracket delimiters",
    );

    const yamlLines = Object.entries(frontmatter).map(([k, v]) => {
      const value = JSON.stringify(v);
      return `${k}: ${value}`;
    });

    const blueprint = frontmatter.blueprint || {};
    const sectionIds = Object.keys(blueprint);

    const body = sectionIds
      .map((id) => {
        const content = sections[id] || "";
        return `[SECTION id="${id}"]\n${content}\n[/SECTION]`;
      })
      .join("\n\n");

    return `---\n${yamlLines.join("\n")}\n---\n\n${body}`;
  }

  /**
   * Encapsulates the creation of a new Hub or Spoke scaffold.
   * Centralizes the template for TODO blocks and frontmatter mapping.
   */
  static generateScaffold(
    brief: Brief,
    blueprint: HubBlueprint,
    title: string,
    description: string,
  ): string {
    const blueprintData: Record<string, any> = {};
    const writerMap: Record<string, string> = {};

    blueprint.components.forEach((c) => {
      blueprintData[c.id] = {
        id: c.id,
        header: c.header,
        intent: c.intent,
        writerId: c.writerId,
        bridge: c.bridge,
      };
      writerMap[c.id] = c.writerId;
    });

    const frontmatter: Partial<ContentFrontmatter> = {
      title,
      description,
      type: "hub",
      hubId: blueprint.hubId,
      topic: brief.topic,
      goal: brief.goal,
      audience: brief.audience,
      language: brief.language,
      date: new Date().toISOString().split("T")[0],
      personaId: brief.personaId,
      blueprint: blueprintData,
    };

    frontmatter.assemblerId = brief.assemblerId;

    const body = blueprint.components
      .map((c) => {
        const content = `## ${c.header}\n\n> **TODO:** ${c.intent}\n\n*Pending generation...*`;
        return `[SECTION id="${c.id}"]\n${content}\n[/SECTION]`;
      })
      .join("\n\n");

    const yaml = Object.entries(frontmatter)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join("\n");

    return `---\n${yaml}\n---\n\n# ${brief.topic}\n\n${body}`;
  }

  static stripInternalMetadata(rawContent: string): string {
    const { data, content } = parseFrontmatter(rawContent);

    const cleanContent = content
      .replace(/\[SECTION id=".*?"\]\n?/gi, "")
      .replace(/\n?\[\/SECTION\]/gi, "")
      .trim();

    return `# ${data.title}\n\n${cleanContent}`;
  }

  private static extractSections(markdownBody: string): Record<string, string> {
    const sections: Record<string, string> = {};
    // Matches [SECTION id="..."]...[/SECTION] across multiple lines
    const sectionRegex = /\[SECTION id="(.*?)"\]([\s\S]*?)\[\/SECTION\]/gi;

    let match;
    while ((match = sectionRegex.exec(markdownBody)) !== null) {
      const id = match[1].trim();
      const content = match[2].trim();
      sections[id] = content;
    }

    return sections;
  }
}

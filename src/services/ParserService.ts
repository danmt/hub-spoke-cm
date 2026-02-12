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
    type: "hub" | "spoke",
    brief: Brief,
    blueprint: HubBlueprint,
    parentHubId?: string,
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
      title: brief.topic,
      type: type,
      hubId: parentHubId || blueprint.hubId,
      goal: brief.goal,
      audience: brief.audience,
      language: brief.language,
      date: new Date().toISOString().split("T")[0],
      personaId: brief.personaId,
      blueprint: blueprintData,
    };

    if (type === "spoke") {
      frontmatter.componentId = blueprint.hubId;
    } else {
      frontmatter.assemblerId = brief.assemblerId;
    }

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

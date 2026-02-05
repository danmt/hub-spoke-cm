// src/core/assemblers/index.ts
import { HubBlueprint, HubComponent } from "../../types/index.js";
import { Brief } from "../agents/Architect.js";

export interface Assembler {
  id: string;
  description: string;
  generateSkeleton(brief: Brief): Promise<HubBlueprint>;
}

/**
 * DeepDiveAssembler
 * Designed for senior-level technical analysis.
 * Focuses on internals, architecture, and performance trade-offs.
 */
export class DeepDiveAssembler implements Assembler {
  id = "deep-dive";
  description =
    "Provides an in-depth architectural analysis. Best for senior engineers, system design, and performance optimizations.";

  async generateSkeleton(brief: Brief): Promise<HubBlueprint> {
    const components: HubComponent[] = [
      {
        id: "architecture",
        header: "Internal Architecture",
        intent: `Analyze the internal structural design of ${brief.topic}.`,
        writerId: "prose",
      },
      {
        id: "mechanics",
        header: "Core Mechanics",
        intent: "Explain the data flow and critical system components.",
        writerId: "prose",
      },
      {
        id: "edge-cases",
        header: "Edge Cases and Constraints",
        intent:
          "Identify common failure modes, bottlenecks, and scalability limits.",
        writerId: "prose",
      },
      {
        id: "optimization",
        header: "Performance Optimization",
        intent: `Advanced technical guide for maximizing the performance of ${brief.goal}.`,
        writerId: "code",
      },
      {
        id: "ecosystem",
        header: "Ecosystem Comparison",
        intent:
          "Compare with alternative solutions and discuss technical trade-offs.",
        writerId: "prose",
      },
    ];

    return {
      hubId: brief.topic.toLowerCase().replace(/\s+/g, "-"),
      components,
    };
  }
}

/**
 * TutorialAssembler: Focuses on a learning-oriented structure.
 */
export class TutorialAssembler implements Assembler {
  id = "tutorial";
  description =
    "Generates a step-by-step learning path. Best for 'How-to' guides, beginners, and project-based learning.";

  async generateSkeleton(brief: Brief): Promise<HubBlueprint> {
    const components: HubComponent[] = [
      {
        id: "intro",
        header: "Introduction",
        intent: `Explain what we are building: ${brief.topic}`,
        writerId: "prose",
      },
      {
        id: "setup",
        header: "Environment Setup",
        intent: "List prerequisites and installation steps",
        writerId: "prose",
      },
      {
        id: "implementation",
        header: "Core Implementation",
        intent: `Step-by-step code guide to achieve: ${brief.goal}`,
        writerId: "code",
      },
      {
        id: "conclusion",
        header: "Next Steps",
        intent: "Summary and where to go from here",
        writerId: "prose",
      },
    ];

    return {
      hubId: brief.topic.toLowerCase().replace(/\s+/g, "-"),
      components,
    };
  }
}

export const ASSEMBLER_REGISTRY: Record<string, Assembler> = {
  tutorial: new TutorialAssembler(),
  "deep-dive": new DeepDiveAssembler(),
};

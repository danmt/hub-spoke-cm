import {
  AgentIdentity,
  AgentKnowledge,
  EvolutionAnalysis,
} from "../types/index.js";
import { IntelligenceService } from "./IntelligenceService.js";
import { IoService } from "./IoService.js";
import { ArtifactType } from "./RegistryService.js";

export type AgentInteractionSource = "action" | "manual";
export type AgentInteractionOutcome = "accepted" | "feedback";

export interface AgentInteractionEntry {
  timestamp: string;
  source: AgentInteractionSource;
  outcome: AgentInteractionOutcome;
  text?: string;
  threadId?: string;
  turn?: number;
}

export class AgentService {
  static async saveAgent(
    workspaceRoot: string,
    params: {
      identity: AgentIdentity;
      behavior: string;
      knowledge: AgentKnowledge;
    },
  ) {
    const pkgDir = IoService.join(
      workspaceRoot,
      "agents",
      `${params.identity.type}s`,
      params.identity.id,
    );

    await IoService.makeDir(pkgDir);
    await IoService.writeFile(
      IoService.join(pkgDir, "agent.json"),
      JSON.stringify(params.identity, null, 2),
    );
    await IoService.writeFile(
      IoService.join(pkgDir, "behavior.md"),
      params.behavior,
    );
    await IoService.writeFile(
      IoService.join(pkgDir, "knowledge.json"),
      JSON.stringify(params.knowledge, null, 2),
    );
  }

  static async appendFeedback(
    workspaceRoot: string,
    type: ArtifactType,
    id: string,
    entry: Omit<AgentInteractionEntry, "timestamp"> & { timestamp?: string },
  ) {
    const path = IoService.join(
      workspaceRoot,
      "agents",
      `${type}s`,
      id,
      "feedback.jsonl",
    );
    const current = (await IoService.exists(path))
      ? await IoService.readFile(path)
      : "";
    await IoService.writeFile(
      path,
      current +
        JSON.stringify({
          ...entry,
          timestamp: new Date().toISOString(),
        }) +
        "\n",
    );
  }

  static async getFeedback(
    workspaceUri: string,
    type: string,
    id: string,
  ): Promise<AgentInteractionEntry[]> {
    const agentDirPath = IoService.join(workspaceUri, "agents", `${type}s`, id);
    const feedbackFile = IoService.join(agentDirPath, "feedback.jsonl");

    if (!(await IoService.exists(feedbackFile))) return [];

    try {
      const content = await IoService.readFile(feedbackFile);
      return content
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => {
          const parsed = JSON.parse(line);
          return {
            timestamp: parsed.timestamp,
            source: parsed.source,
            outcome: parsed.outcome,
            text: parsed.text,
            threadId: parsed.threadId,
            turn: parsed.turn,
          };
        })
        .reverse(); // Newest first for the Learning History list
    } catch (error) {
      console.error("AgentsStorage: Failed to read feedback buffer", error);
      return [];
    }
  }

  /**
   * Retrieves the raw feedback buffer content as a string for LLM analysis.
   */
  static async getRawFeedbackBuffer(
    workspaceRoot: string,
    type: ArtifactType,
    id: string,
  ): Promise<string> {
    const path = IoService.join(
      workspaceRoot,
      "agents",
      `${type}s`,
      id,
      "feedback.jsonl",
    );
    if (!(await IoService.exists(path))) return "";
    return await IoService.readFile(path);
  }

  /**
   * Deletes the feedback buffer after a successful evolution cycle.
   */
  static async clearFeedbackBuffer(
    workspaceRoot: string,
    type: ArtifactType,
    id: string,
  ): Promise<void> {
    const path = IoService.join(
      workspaceRoot,
      "agents",
      `${type}s`,
      id,
      "feedback.jsonl",
    );
    if (await IoService.exists(path)) {
      // In Phase 7 we will move this to archive instead of just deleting
      await IoService.writeFile(path, "");
    }
  }

  /**
   * Physically clones an agent package into a new directory with a new identity.
   * Filters knowledge to remove contradictions as defined in Phase 4.
   */
  static async forkAgent(
    apiKey: string,
    model: string,
    workspaceRoot: string,
    originalId: string,
    newId: string,
    type: ArtifactType,
    newDisplayName: string,
    analysis: EvolutionAnalysis,
  ): Promise<{
    id: string;
    description: string;
    truths: {
      text: string;
      weight: number;
    }[];
  }> {
    const oldPkgDir = IoService.join(
      workspaceRoot,
      "agents",
      `${type}s`,
      originalId,
    );
    const newPkgDir = IoService.join(
      workspaceRoot,
      "agents",
      `${type}s`,
      newId,
    );

    // 1. Read current core artifacts from parent
    const identityRaw = await IoService.readFile(
      IoService.join(oldPkgDir, "agent.json"),
    );
    const behavior = await IoService.readFile(
      IoService.join(oldPkgDir, "behavior.md"),
    );
    const knowledgeRaw = await IoService.readFile(
      IoService.join(oldPkgDir, "knowledge.json"),
    );

    const parentIdentity = JSON.parse(identityRaw);
    const parentKnowledge: AgentKnowledge = JSON.parse(knowledgeRaw);

    // 3. Update Identity Metadata if a metadata field was violated
    const childIdentity = {
      ...parentIdentity,
      id: newId,
      displayName: newDisplayName,
    };

    if (
      analysis.violatedMetadataField &&
      analysis.newMetadataValue &&
      childIdentity.metadata
    ) {
      childIdentity.metadata[analysis.violatedMetadataField] =
        analysis.newMetadataValue;
    }

    const truthsToPurge = new Set([
      analysis.violatedTruth,
      ...(analysis.contradictoryTruths || []),
    ]);

    const childTruths = parentKnowledge.truths.filter(
      (t) => !truthsToPurge.has(t.text),
    );

    const newDescription =
      await IntelligenceService.generateInferredDescription(
        apiKey,
        model,
        newDisplayName,
        behavior,
        childTruths,
        childIdentity.metadata || {},
      );

    // 4. Create new package structure
    await IoService.makeDir(newPkgDir);
    await IoService.writeFile(
      IoService.join(newPkgDir, "agent.json"),
      JSON.stringify(childIdentity, null, 2),
    );
    await IoService.writeFile(
      IoService.join(newPkgDir, "behavior.md"),
      behavior,
    );

    // Save filtered knowledge
    await IoService.writeFile(
      IoService.join(newPkgDir, "knowledge.json"),
      JSON.stringify(
        {
          description: newDescription,
          truths: childTruths,
        },
        null,
        2,
      ),
    );

    // 5. Write Lineage Data (birth.json)
    const birthData = {
      parentId: originalId,
      birthReason: analysis.thoughtProcess,
      timestamp: new Date().toISOString(),
    };
    await IoService.writeFile(
      IoService.join(newPkgDir, "birth.json"),
      JSON.stringify(birthData, null, 2),
    );

    return { id: newId, description: newDescription, truths: childTruths };
  }
}

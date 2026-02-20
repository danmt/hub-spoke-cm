import {
  AgentIdentity,
  AgentInteractionEntry,
  AgentKnowledge,
} from "@hub-spoke/core";
import { Directory, File } from "expo-file-system";

export interface SaveAgentPackageParams {
  workspaceUri: string;
  identity: AgentIdentity;
  behavior: string;
  knowledge: AgentKnowledge;
  birthReason?: string; // Only provided on creation
}

export class AgentsStorage {
  static async saveAgentPackage({
    workspaceUri,
    identity,
    behavior,
    knowledge,
  }: SaveAgentPackageParams): Promise<void> {
    const agentDir = new Directory(
      workspaceUri,
      "agents",
      `${identity.type}s`,
      identity.id,
    );
    const isNew = !agentDir.exists;

    if (isNew) {
      agentDir.create();
    }

    // Always update Identity and Behavior
    new File(agentDir, "agent.json").write(JSON.stringify(identity, null, 2));
    new File(agentDir, "behavior.md").write(behavior.trim());

    // Knowledge: In Phase 1, we overwrite the description but keep existing truths
    new File(agentDir, "knowledge.json").write(
      JSON.stringify(knowledge, null, 2),
    );

    const feedbackFile = new File(agentDir, "feedback.jsonl");

    if (!feedbackFile.exists) {
      feedbackFile.create();
    }

    const birthFile = new File(agentDir, "birth.json");

    if (!birthFile.exists) {
      birthFile.write(
        JSON.stringify(
          {
            birthReason: "Manual Creation",
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    }
  }

  /**
   * Retrieves the complete interaction history for an agent.
   * Parses the JSONL buffer and returns newest items first.
   */
  static async getAgentFeedback(
    workspaceUri: string,
    type: string,
    id: string,
  ): Promise<AgentInteractionEntry[]> {
    const agentDir = new Directory(workspaceUri, "agents", `${type}s`, id);
    const feedbackFile = new File(agentDir, "feedback.jsonl");

    if (!feedbackFile.exists) return [];

    try {
      const content = await feedbackFile.text();
      return content
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => {
          const parsed = JSON.parse(line);
          return {
            timestamp: parsed.timestamp,
            source: parsed.source || "action",
            outcome: parsed.outcome,
            text: parsed.text || "",
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
}

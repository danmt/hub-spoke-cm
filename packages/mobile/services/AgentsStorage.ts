import { AgentIdentity, AgentKnowledge } from "@hub-spoke/core";
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
}

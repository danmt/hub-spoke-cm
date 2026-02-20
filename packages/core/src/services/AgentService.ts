import { AgentIdentity, AgentKnowledge } from "../types/index.js";
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

    if (!IoService.exists(feedbackFile)) return [];

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
}

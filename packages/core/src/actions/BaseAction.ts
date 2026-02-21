import { AgentService } from "../services/AgentService.js";

export type ResolveInteractionResponse =
  | {
      action: "skip";
    }
  | {
      action: "proceed";
    }
  | {
      action: "feedback";
      feedback: string;
    };

export type ResolvedInteractionResponse =
  | {
      action: "proceed";
    }
  | {
      action: "feedback";
      feedback: string;
    };

export type ResolveInteractionHandler<T> = (
  params: T,
) => Promise<ResolveInteractionResponse>;

export class BaseAction {
  constructor(public workspaceRoot: string) {}

  // Shared logic for both CreateHubAction and FillAction
  protected async resolveInteraction<T>(
    type: "persona" | "writer" | "assembler",
    agentId: string,
    params: T,
    handler?: (params: T) => Promise<ResolveInteractionResponse>,
    context?: { threadId: string; turn: number },
  ): Promise<ResolvedInteractionResponse> {
    // 1. Headless/Missing Handler Check -> Early Return
    if (!handler) return { action: "proceed" };

    // 2. Execute Platform Handler
    const result = await handler(params);

    // 3. Skip Action Check -> Early Return (No logging)
    if (result.action === "skip") return { action: "proceed" };

    // 4. Manual Feedback Check -> Persistence
    // We only log if it was a real human "Proceed" or "Feedback"
    if (context) {
      await AgentService.appendFeedback(this.workspaceRoot, type, agentId, {
        source: "action",
        outcome: result.action === "proceed" ? "accepted" : "feedback",
        threadId: context.threadId,
        turn: context.turn,
        ...(result.action === "feedback" ? { text: result.feedback } : {}),
      });
    }

    // 5. Return clean result (either proceed or feedback)
    return result as
      | { action: "proceed" }
      | { action: "feedback"; feedback: string };
  }
}

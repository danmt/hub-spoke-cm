// packages/core/src/services/EvolutionEngine.ts
import { AgentService } from "./AgentService.js";
import { EvolutionService } from "./EvolutionService.js";
import { IntelligenceService } from "./IntelligenceService.js";
import { LoggerService } from "./LoggerService.js";
import { ArtifactType, RegistryService } from "./RegistryService.js";

export interface EvolutionResult {
  thoughtProcess: string;
  addedTruths: string[];
  strengthenedTruths: string[];
  weakenedTruths: string[];
  newDescription: string;
}

export class EvolutionEngine {
  /**
   * The complete asynchronous learning loop for a single agent.
   */
  static async evolve(
    workspaceRoot: string,
    apiKey: string,
    model: string,
    type: ArtifactType,
    id: string,
  ): Promise<EvolutionResult> {
    await LoggerService.info(`EvolutionEngine: Starting cycle for ${id}`);

    // 1. Load Current State
    const artifacts = await RegistryService.sync(workspaceRoot);
    const artifact = artifacts.find((a) => a.id === id && a.type === type);

    if (!artifact) {
      throw new Error(`EvolutionEngine: Agent ${id} not found in registry.`);
    }

    const feedbackBuffer = await AgentService.getRawFeedbackBuffer(
      workspaceRoot,
      type,
      id,
    );
    if (!feedbackBuffer.trim()) {
      throw new Error(
        `EvolutionEngine: No feedback found in buffer for ${id}.`,
      );
    }

    // 2. AI Analysis
    const analysis = await EvolutionService.analyzeEvolution({
      apiKey,
      model,
      displayName: artifact.displayName,
      behavior: artifact.content,
      knowledge: {
        description: artifact.description,
        truths: artifact.truths,
      },
      feedbackBuffer,
    });

    // 3. Apply Proposals
    const updatedTruths = EvolutionService.applyProposals(
      artifact.truths,
      analysis.proposals,
    );

    // 4. Regenerate functional description based on new knowledge
    const newDescription =
      await IntelligenceService.generateInferredDescription(
        apiKey,
        model,
        artifact.displayName,
        artifact.content,
        updatedTruths,
      );

    // 5. Persist Changes
    await AgentService.saveAgent(workspaceRoot, {
      identity: {
        id: artifact.id,
        type: artifact.type,
        displayName: artifact.displayName,
        ...(artifact.type === "persona" ? { metadata: artifact.metadata } : {}),
      },
      behavior: artifact.content,
      knowledge: {
        description: newDescription,
        truths: updatedTruths,
      },
    });

    // 6. Cleanup (Phase 7 will handle archiving here)
    await AgentService.clearFeedbackBuffer(workspaceRoot, type, id);

    return {
      thoughtProcess: analysis.thoughtProcess,
      addedTruths: analysis.proposals
        .filter((p) => p.action === "add")
        .map((p) => p.text),
      strengthenedTruths: analysis.proposals
        .filter((p) => p.action === "strengthen")
        .map((p) => p.text),
      weakenedTruths: analysis.proposals
        .filter((p) => p.action === "weaken")
        .map((p) => p.text),
      newDescription,
    };
  }
}

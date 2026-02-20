// packages/core/src/services/EvolutionEngine.ts
import { AgentKnowledge, EvolutionAnalysis } from "../types/index.js";
import { AgentService } from "./AgentService.js";
import { EvolutionService } from "./EvolutionService.js";
import { IntelligenceService } from "./IntelligenceService.js";
import { IoService } from "./IoService.js";
import { LoggerService } from "./LoggerService.js";
import { ArtifactType, RegistryService } from "./RegistryService.js";

export interface EvolutionResult {
  thoughtProcess: string;
  addedTruths: string[];
  strengthenedTruths: string[];
  weakenedTruths: string[];
  newDescription: string;
  conflictType: "none" | "soft" | "hard";
  forkRecommended: boolean;
  violatedTruth: string | null;
  violatedMetadataField: string | null;
  newMetadataValue: string | null;
  suggestedForkName: string | null;
  analysis: EvolutionAnalysis; // Full analysis for the fork process
}

export class EvolutionEngine {
  /**
   * The complete asynchronous learning loop for a single agent.
   * In Phase 4, this now detects Hard Conflicts and pauses for a decision.
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

    // 2. AI Analysis (Now checks for semantic contradictions and metadata violations)
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
      // Metadata check for personas
      metadata: artifact.type === "persona" ? artifact.metadata : undefined,
    });

    // 3. Prepare updated truths (if we were to proceed with a standard update)
    const updatedTruths = EvolutionService.applyProposals(
      artifact.truths,
      analysis.proposals,
    );

    // 4. Regenerate functional description
    const newDescription =
      await IntelligenceService.generateInferredDescription(
        apiKey,
        model,
        artifact.displayName,
        artifact.content,
        updatedTruths,
      );

    // 5. DECISION BRIDGE: Only auto-update if there is NO Hard Conflict
    if (analysis.conflictType !== "hard") {
      await AgentService.saveAgent(workspaceRoot, {
        identity: {
          id: artifact.id,
          type: artifact.type,
          displayName: artifact.displayName,
          ...(artifact.type === "persona"
            ? { metadata: artifact.metadata }
            : {}),
        },
        behavior: artifact.content,
        knowledge: {
          description: newDescription,
          truths: updatedTruths,
        },
      });

      // Cleanup buffer after successful soft evolution
      await AgentService.clearFeedbackBuffer(workspaceRoot, type, id);
    } else {
      await LoggerService.warn(
        `EvolutionEngine: Hard conflict detected for ${id}. Pausing for user decision.`,
      );
    }

    return {
      thoughtProcess: analysis.thoughtProcess,
      conflictType: analysis.conflictType,
      forkRecommended: analysis.forkRecommended,
      violatedTruth: analysis.violatedTruth,
      violatedMetadataField: analysis.violatedMetadataField,
      newMetadataValue: analysis.newMetadataValue,
      suggestedForkName: analysis.suggestedForkName,
      analysis: analysis,
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

  /**
   * forkFromConflict: The Orchestrator for reactive forks.
   * This logic lives here because it requires the AI (IntelligenceService)
   * to clean up the new agent's identity.
   */
  static async forkFromConflict(
    workspaceRoot: string,
    apiKey: string,
    model: string,
    originalId: string,
    newId: string,
    type: ArtifactType,
    newDisplayName: string,
    analysis: EvolutionAnalysis,
  ): Promise<{ id: string; name: string; description: string }> {
    const oldPkgDir = IoService.join(
      workspaceRoot,
      "agents",
      `${type}s`,
      originalId,
    );

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

    // 1. Semantic Purge: Identify truths that clash with the conflict/new metadata
    const truthsToPurge = new Set([
      analysis.violatedTruth,
      ...(analysis.contradictoryTruths || []),
    ]);
    const childTruths = parentKnowledge.truths.filter(
      (t) => !truthsToPurge.has(t.text),
    );

    // 2. Metadata Pivot: Apply the AI-suggested change (e.g. Tone: Joking)
    const childMetadata = { ...(parentIdentity.metadata || {}) };
    if (analysis.violatedMetadataField && analysis.newMetadataValue) {
      childMetadata[analysis.violatedMetadataField] = analysis.newMetadataValue;
    }

    // 3. AI Inference: Generate a fresh description based on the specialized identity
    const newDescription =
      await IntelligenceService.generateInferredDescription(
        apiKey,
        model,
        newDisplayName,
        behavior,
        childTruths,
        childMetadata,
      );

    // 4. Execution: Tell AgentService to perform the physical I/O
    await AgentService.forkAgent(workspaceRoot, {
      originalId,
      newId,
      type,
      newDisplayName,
      newMetadata: childMetadata,
      newDescription,
      newTruths: childTruths,
      birthReason: analysis.thoughtProcess,
    });

    await AgentService.clearFeedbackBuffer(workspaceRoot, type, originalId);

    return { id: newId, name: newDisplayName, description: newDescription };
  }

  /**
   * forkFromManualChange: The Orchestrator for proactive/user-driven forks.
   * Used when a user manually edits behavior or metadata and wants a
   * "Smart Clone" that filters existing knowledge for compatibility.
   */
  static async forkFromManualChange(
    workspaceRoot: string,
    apiKey: string,
    model: string,
    originalId: string,
    newId: string,
    type: ArtifactType,
    newDisplayName: string,
    newBehavior: string,
    newMetadata: Record<string, any>,
  ): Promise<{ id: string; name: string; description: string }> {
    const oldPkgDir = IoService.join(
      workspaceRoot,
      "agents",
      `${type}s`,
      originalId,
    );

    // 1. Load Parent Knowledge
    const knowledgeRaw = await IoService.readFile(
      IoService.join(oldPkgDir, "knowledge.json"),
    );
    const parentKnowledge: AgentKnowledge = JSON.parse(knowledgeRaw);

    // 2. Smart Knowledge Migration
    // We ask the AI to compare the OLD truths against the NEW behavior.
    const migration = await IntelligenceService.migrateKnowledge(
      apiKey,
      model,
      newBehavior,
      parentKnowledge.truths,
    );

    // 3. Generate Specialized Description for the new behavior/metadata
    const newDescription =
      await IntelligenceService.generateInferredDescription(
        apiKey,
        model,
        newDisplayName,
        newBehavior,
        migration.keptTruths,
        newMetadata,
      );

    // 4. Execution: Create the physical artifacts
    await AgentService.forkAgent(workspaceRoot, {
      originalId,
      newId,
      type,
      newDisplayName,
      newMetadata,
      newBehavior,
      newDescription,
      newTruths: migration.keptTruths,
      birthReason: `Manual behavior evolution: ${migration.thoughtProcess}`,
    });

    return { id: newId, name: newDisplayName, description: newDescription };
  }
}

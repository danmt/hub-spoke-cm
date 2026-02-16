// packages/mobile/services/AgentsContext.tsx
import { AgentPair, RegistryService } from "@hub-spoke/core";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useWorkspace } from "./WorkspaceContext";
import { WorkspaceManager } from "./WorkspaceManager";

interface AgentsContextType {
  agents: AgentPair[];
  getAgent: <T extends AgentPair["type"]>(
    type: T,
    id: string,
  ) => Extract<AgentPair, { type: T }> | null;
  isLoading: boolean;
}

const AgentsContext = createContext<AgentsContextType | undefined>(undefined);

export function AgentsProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [agents, setAgents] = useState<AgentPair[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadAgents() {
      if (!activeWorkspace || workspaceLoading) return;

      setIsLoading(true);
      try {
        const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);

        // Sync artifacts from the filesystem via Core RegistryService
        const artifacts = await RegistryService.getAllArtifacts(
          workspaceDir.uri,
        );

        // Initialize functional agents.
        // We use dummy credentials here; they are swapped during actual AI Action execution.
        const initialized = RegistryService.initializeAgents(
          "DUMMY_KEY",
          "gemini-2.0-flash",
          artifacts,
        );

        setAgents(initialized);
      } catch (err) {
        console.error("AgentsProvider: Failed to load agents", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadAgents();
  }, [activeWorkspace, workspaceLoading]);

  const getAgent = <T extends AgentPair["type"]>(type: T, id: string) => {
    return agents.find(
      (a) => a.type === type && a.artifact.id === id,
    ) as Extract<AgentPair, { type: T }> | null;
  };

  return (
    <AgentsContext.Provider value={{ agents, getAgent, isLoading }}>
      {children}
    </AgentsContext.Provider>
  );
}

export const useAgents = () => {
  const context = useContext(AgentsContext);
  if (!context)
    throw new Error("useAgents must be used within an AgentsProvider");
  return context;
};

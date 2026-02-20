// packages/mobile/services/AgentsContext.tsx
import {
  AgentPair,
  ConfigService,
  RegistryService,
  SecretService,
} from "@hub-spoke/core";
import { File } from "expo-file-system";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert } from "react-native";
import { useWorkspace } from "./WorkspaceContext";
import { WorkspaceManager } from "./WorkspaceManager";

interface AgentsContextType {
  agents: AgentPair[];
  getAgent: <T extends AgentPair["type"]>(
    type: T,
    id: string,
  ) => Extract<AgentPair, { type: T }> | null;
  isLoading: boolean;
  deleteAgent: (type: AgentPair["type"], id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AgentsContext = createContext<AgentsContextType | undefined>(undefined);

export function AgentsProvider({ children }: { children: React.ReactNode }) {
  const {
    activeWorkspace,
    isLoading: workspaceLoading,
    manifest,
    updateManifest,
  } = useWorkspace();
  const [agents, setAgents] = useState<AgentPair[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const syncAgents = useCallback(async () => {
    if (!activeWorkspace) return;

    setIsLoading(true);
    try {
      const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
      const secret = await SecretService.getSecret();
      const config = await ConfigService.getConfig();

      if (!secret.apiKey) {
        throw new Error(
          "Missing Gemini API Key. Please configure it in Settings.",
        );
      }

      RegistryService.clearCache();

      const artifacts = await RegistryService.getAllArtifacts(workspaceDir.uri);
      const initialized = RegistryService.initializeAgents(
        secret.apiKey,
        config.model || "gemini-2.0-flash",
        artifacts,
      );

      setAgents(initialized);
    } catch (err: any) {
      console.error("AgentsProvider Sync Error:", err);
      Alert.alert("Registry Error", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (!workspaceLoading) {
      syncAgents();
    }
  }, [activeWorkspace, workspaceLoading, syncAgents]);

  const getAgent = <T extends AgentPair["type"]>(type: T, id: string) => {
    console.log(agents, type, id);

    agents.forEach((agent) =>
      console.log(agent.agent.id, agent.artifact.id, id),
    );

    return agents.find(
      (a) => a.type === type && a.artifact.id === id,
    ) as Extract<AgentPair, { type: T }> | null;
  };

  const deleteAgent = async (type: AgentPair["type"], id: string) => {
    if (!activeWorkspace || !manifest) return;

    const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
    const folderName = `${type}s`;
    const agentFile = new File(
      workspaceDir.uri,
      "agents",
      folderName,
      `${id}.md`,
    );

    if (agentFile.exists) {
      agentFile.delete();
    }

    // Update functional state and shadow index
    setAgents((prev) => prev.filter((a) => a.artifact.id !== id));
    const updatedAgents = manifest.agents.filter((a) => a.id !== id);
    await updateManifest({ agents: updatedAgents });
  };

  return (
    <AgentsContext.Provider
      value={{ agents, getAgent, isLoading, deleteAgent, refresh: syncAgents }}
    >
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

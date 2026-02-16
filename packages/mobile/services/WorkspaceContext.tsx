// packages/mobile/services/WorkspaceContext.tsx
import {
  AgentIndexEntry,
  WorkspaceManifest,
  WorkspaceManifestSchema,
} from "@/types/manifest";
import { IoService, LoggerService, RegistryService } from "@hub-spoke/core";
import { Directory, File } from "expo-file-system";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { WorkspaceManager } from "./WorkspaceManager";
import { WorkspaceStorage } from "./WorkspaceStorage";

interface WorkspaceContextType {
  activeWorkspace: string | undefined;
  switchWorkspace: (id: string | undefined) => Promise<void>;
  manifest: WorkspaceManifest | null;
  isLoading: boolean;
  reindex: () => Promise<void>;
  updateManifest: (changes: Partial<WorkspaceManifest>) => Promise<void>;
  upsertAgentIndex: (entry: AgentIndexEntry) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeWorkspace, setActiveWorkspace] = useState<string | undefined>();
  const [manifest, setManifest] = useState<WorkspaceManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const crawlAndIndex = async (
    workspaceId: string,
  ): Promise<WorkspaceManifest> => {
    const workspaceDir = WorkspaceManager.getWorkspaceUri(workspaceId);

    const artifacts = await RegistryService.getAllArtifacts(workspaceDir.uri);
    const agentEntries = artifacts.map((a) => ({
      id: a.id,
      type: a.type,
      name: (a as any).name,
      description: a.description,
    }));

    const hubIds = await IoService.findAllHubsInWorkspace(workspaceDir.uri);
    const hubEntries = await Promise.all(
      hubIds.map(async (hubId) => {
        const hubDir = new Directory(workspaceDir.uri, "posts", hubId);
        const parsed = await IoService.readHub(hubDir.uri);
        return {
          id: hubId,
          title: parsed.frontmatter.title,
          hasTodo: />\s*\*\*?TODO:?\*?\s*/i.test(parsed.content),
          lastModified: new Date().toISOString(),
        };
      }),
    );

    const newManifest: WorkspaceManifest = {
      hubs: hubEntries,
      agents: agentEntries,
      lastSynced: new Date().toISOString(),
    };

    const manifestFile = new File(workspaceDir, ".hub", "workspace.json");
    if (!manifestFile.parentDirectory?.exists) {
      manifestFile.parentDirectory?.create();
    }
    manifestFile.write(JSON.stringify(newManifest, null, 2));

    return newManifest;
  };

  const loadOrCreateManifest = async (
    workspaceId: string,
  ): Promise<WorkspaceManifest> => {
    const workspaceDir = WorkspaceManager.getWorkspaceUri(workspaceId);
    const manifestFile = new File(workspaceDir, ".hub", "workspace.json");

    if (manifestFile.exists) {
      const raw = await manifestFile.text();
      return WorkspaceManifestSchema.parse(JSON.parse(raw));
    }

    return await crawlAndIndex(workspaceId);
  };

  const syncWorkspaceData = async (id: string | undefined) => {
    setIsLoading(true);
    if (!id) {
      setActiveWorkspace(undefined);
      setManifest(null);
      setIsLoading(false);
      return;
    }

    try {
      await WorkspaceManager.switchWorkspace(id);

      const activeManifest = await loadOrCreateManifest(id);
      setManifest(activeManifest);
      setActiveWorkspace(id);

      await LoggerService.info(`Workspace [${id}] ready.`, { workspaceId: id });
    } catch (err: any) {
      console.error("Workspace sync error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateManifest = async (changes: Partial<WorkspaceManifest>) => {
    if (!activeWorkspace || !manifest) return;

    const updatedManifest: WorkspaceManifest = {
      ...manifest,
      ...changes,
      lastSynced: new Date().toISOString(),
    };

    const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
    const manifestFile = new File(workspaceDir, ".hub", "workspace.json");

    manifestFile.write(JSON.stringify(updatedManifest, null, 2));
    setManifest(updatedManifest);

    await LoggerService.debug("Shadow index updated incrementally", {
      workspaceId: activeWorkspace,
    });
  };

  const upsertAgentIndex = async (entry: AgentIndexEntry) => {
    if (!activeWorkspace || !manifest) return;

    const existingAgents = manifest.agents || [];
    const index = existingAgents.findIndex((a) => a.id === entry.id);

    let newAgents;
    if (index > -1) {
      newAgents = [...existingAgents];
      newAgents[index] = entry;
    } else {
      newAgents = [...existingAgents, entry];
    }

    await updateManifest({ agents: newAgents });
  };

  useEffect(() => {
    WorkspaceStorage.getActiveWorkspace().then(syncWorkspaceData);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspace,
        switchWorkspace: syncWorkspaceData,
        manifest,
        isLoading,
        reindex: () =>
          activeWorkspace
            ? crawlAndIndex(activeWorkspace).then(setManifest)
            : Promise.resolve(),
        updateManifest,
        upsertAgentIndex,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}

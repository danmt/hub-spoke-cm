// packages/mobile/services/WorkspaceContext.tsx
import { MobileLoggerProvider } from "@/providers/MobileLoggerProvider";
import { MobileRegistryProvider } from "@/providers/MobileRegistryProvider";
import { RegistryService } from "@hub-spoke/core";
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
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeWorkspace, setActiveWorkspace] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const loadWorkspaceData = async (id: string | undefined) => {
    setIsLoading(true);
    if (!id) {
      setActiveWorkspace(undefined);
      setIsLoading(false);
      return;
    }

    try {
      const workspaceDir = WorkspaceManager.getWorkspaceUri(id);

      // 1. Set providers first
      await WorkspaceManager.switchWorkspace(id, {
        logger: new MobileLoggerProvider(),
        registry: new MobileRegistryProvider(workspaceDir.uri),
      });

      // 2. Await the sync before proceeding
      await RegistryService.getAllArtifacts(workspaceDir.uri);

      setActiveWorkspace(id);
    } catch (err) {
      console.error("Failed to load workspace data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    WorkspaceStorage.getActiveWorkspace().then(loadWorkspaceData);
  }, []);

  const switchWorkspace = async (id: string | undefined) => {
    await loadWorkspaceData(id);
  };

  return (
    <WorkspaceContext.Provider
      value={{ activeWorkspace, switchWorkspace, isLoading }}
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

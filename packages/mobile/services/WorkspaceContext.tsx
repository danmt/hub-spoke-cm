// packages/mobile/services/WorkspaceContext.tsx
import { MobileLoggerProvider } from "@/providers/MobileLoggerProvider";
import { MobileRegistryProvider } from "@/providers/MobileRegistryProvider";
import { Paths } from "expo-file-system";
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

  useEffect(() => {
    async function init() {
      const ws = await WorkspaceStorage.getActiveWorkspace();
      // Initialize core providers for the last saved workspace
      const workspaceDir = WorkspaceManager.getWorkspaceUri(ws);
      await WorkspaceManager.switchWorkspace(ws, {
        logger: new MobileLoggerProvider(),
        registry: new MobileRegistryProvider(workspaceDir.uri),
      });
      setActiveWorkspace(ws);
      setIsLoading(false);
    }
    init();
  }, []);

  const switchWorkspace = async (id: string | undefined) => {
    if (!id) {
      await WorkspaceManager.clearActiveWorkspace({
        logger: new MobileLoggerProvider(),
        registry: new MobileRegistryProvider(Paths.document.uri),
      });
    } else {
      const workspaceDir = WorkspaceManager.getWorkspaceUri(id);
      await WorkspaceManager.switchWorkspace(id, {
        logger: new MobileLoggerProvider(),
        registry: new MobileRegistryProvider(workspaceDir.uri),
      });
    }
    setActiveWorkspace(id);
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

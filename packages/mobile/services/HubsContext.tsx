// packages/mobile/services/HubsContext.tsx
import { IoService, ParsedFile } from "@hub-spoke/core";
import { Directory } from "expo-file-system";
import React, { createContext, useContext, useRef, useState } from "react";
import { useWorkspace } from "./WorkspaceContext";
import { WorkspaceManager } from "./WorkspaceManager";

interface HubsContextType {
  getFullHub: (id: string) => Promise<ParsedFile>;
  invalidateCache: (id?: string) => void;
  deleteHub: (id: string) => Promise<void>;
}

const MAX_CACHED_HUBS = 5;
const HubsContext = createContext<HubsContextType | undefined>(undefined);

export function HubsProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace, manifest, updateManifest } = useWorkspace();
  const [cache, setCache] = useState<Map<string, ParsedFile>>(new Map());
  const accessOrder = useRef<string[]>([]);

  const getFullHub = async (id: string): Promise<ParsedFile> => {
    if (!activeWorkspace) throw new Error("No active workspace.");

    if (cache.has(id)) {
      accessOrder.current = [
        id,
        ...accessOrder.current.filter((i) => i !== id),
      ];
      return cache.get(id)!;
    }

    const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
    const hubPath = `${workspaceDir.uri}/posts/${id}`;
    const data = await IoService.readHub(hubPath);

    setCache((prev) => {
      const next = new Map(prev);
      if (next.size >= MAX_CACHED_HUBS) {
        const oldest = accessOrder.current.pop();
        if (oldest) next.delete(oldest);
      }
      next.set(id, data);
      return next;
    });

    accessOrder.current = [id, ...accessOrder.current.filter((i) => i !== id)];
    return data;
  };

  const invalidateCache = (id?: string) => {
    if (id) {
      setCache((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      accessOrder.current = accessOrder.current.filter((i) => i !== id);
    } else {
      setCache(new Map());
      accessOrder.current = [];
    }
  };

  const deleteHub = async (id: string) => {
    if (!activeWorkspace || !manifest) return;
    const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
    const hubDir = new Directory(workspaceDir.uri, "posts", id);

    if (hubDir.exists) {
      await WorkspaceManager.deleteRecursively(hubDir.uri);
    }

    invalidateCache(id);
    const updatedHubs = manifest.hubs.filter((h) => h.id !== id);
    await updateManifest({ hubs: updatedHubs });
  };

  return (
    <HubsContext.Provider value={{ getFullHub, invalidateCache, deleteHub }}>
      {children}
    </HubsContext.Provider>
  );
}

export const useHubs = () => {
  const context = useContext(HubsContext);
  if (!context) throw new Error("useHubs must be used within a HubsProvider");
  return context;
};

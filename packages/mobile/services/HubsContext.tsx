// packages/mobile/services/HubsContext.tsx
import { IoService, ParsedFile } from "@hub-spoke/core";
import React, { createContext, useContext, useRef, useState } from "react";
import { useWorkspace } from "./WorkspaceContext";
import { WorkspaceManager } from "./WorkspaceManager";

interface HubsContextType {
  /**
   * Retrieves full hub data, hitting the LRU cache if available.
   */
  getFullHub: (id: string) => Promise<ParsedFile>;
  /**
   * Removes an entry from the cache to force a fresh read on next access.
   */
  invalidateCache: (id?: string) => void;
}

const MAX_CACHED_HUBS = 5;

const HubsContext = createContext<HubsContextType | undefined>(undefined);

export function HubsProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const [cache, setCache] = useState<Map<string, ParsedFile>>(new Map());

  // Ref to track the order of access for LRU rotation logic
  const accessOrder = useRef<string[]>([]);

  const getFullHub = async (id: string): Promise<ParsedFile> => {
    if (!activeWorkspace) {
      throw new Error(
        "HubsProvider: Cannot fetch hub without an active workspace.",
      );
    }

    // 1. Check LRU Cache
    if (cache.has(id)) {
      // Move to front of access order
      accessOrder.current = [
        id,
        ...accessOrder.current.filter((i) => i !== id),
      ];
      return cache.get(id)!;
    }

    // 2. Cache Miss: Read via Core Service (Stateless)
    const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
    const hubPath = `${workspaceDir.uri}/posts/${id}`;
    const data = await IoService.readHub(hubPath);

    // 3. Update Cache & Apply Rotation
    setCache((prev) => {
      const next = new Map(prev);

      if (next.size >= MAX_CACHED_HUBS) {
        const oldest = accessOrder.current.pop();
        if (oldest) next.delete(oldest);
      }

      next.set(id, data);
      return next;
    });

    // Update access order
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

  return (
    <HubsContext.Provider value={{ getFullHub, invalidateCache }}>
      {children}
    </HubsContext.Provider>
  );
}

export const useHubs = () => {
  const context = useContext(HubsContext);
  if (!context) {
    throw new Error("useHubs must be used within a HubsProvider");
  }
  return context;
};

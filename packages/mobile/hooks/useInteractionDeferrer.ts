import { AskHandler, InteractionType } from "@/types/interactions";
import { useCallback, useRef, useState } from "react";

export function useInteractionDeferrer() {
  const [pendingInteraction, setPendingInteraction] = useState<{
    type: InteractionType;
    data: any;
    resolve: (val: any) => void;
    reject: (err: Error) => void;
  } | null>(null);

  const isAwaiting = useRef(false);

  const ask: AskHandler = useCallback((type, data) => {
    if (isAwaiting.current) {
      throw new Error("InteractionDeferrer: Already awaiting an interaction.");
    }

    isAwaiting.current = true;

    return new Promise((resolve, reject) => {
      setPendingInteraction({ type, data, resolve, reject });
    });
  }, []);

  const handleResolve = useCallback(
    (response: any) => {
      if (!pendingInteraction) return;
      const { resolve } = pendingInteraction;
      setPendingInteraction(null);
      isAwaiting.current = false;
      setTimeout(() => resolve(response), 0);
    },
    [pendingInteraction],
  );

  const handleReject = useCallback(
    (error: Error) => {
      if (!pendingInteraction) return;
      const { reject } = pendingInteraction;
      setPendingInteraction(null);
      isAwaiting.current = false;
      setTimeout(() => reject(error), 0);
    },
    [pendingInteraction],
  );

  return {
    pendingInteraction,
    ask,
    handleResolve,
    handleReject,
    isInteracting: !!pendingInteraction,
  };
}

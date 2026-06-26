import {useCallback, useState} from "react";

import type {ApiClient} from "../api";
import type {MemoryItem} from "../types";

// Long-term memory list lives at the app level so it persists across
// chat<->settings navigation (SettingsWorkspace unmounts on view switch).
export function useMemory({api, userId}: {api: ApiClient; userId: number}) {
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);

  const refreshMemories = useCallback(async () => {
    setMemoryItems(await api.listUserMemories(userId, 20));
  }, [api, userId]);

  return {memoryItems, setMemoryItems, refreshMemories};
}

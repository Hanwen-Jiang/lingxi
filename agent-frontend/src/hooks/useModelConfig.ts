import {useCallback, useState} from "react";

import type {ApiClient} from "../api";
import {getErrorMessage} from "../lib/chat";
import type {ModelStatusResponse} from "../types";

export function useModelConfig({api}: {api: ApiClient}) {
  const [health, setHealth] = useState<"checking" | "up" | "down">("checking");
  const [healthMessage, setHealthMessage] = useState("Checking backend health");
  const [modelStatus, setModelStatus] = useState<ModelStatusResponse | null>(null);

  const checkHealth = useCallback(async () => {
    setHealth("checking");
    setHealthMessage("Checking backend health");
    try {
      const [healthResult, model] = await Promise.all([api.health(), api.modelStatus()]);
      const status = healthResult.status ?? "UNKNOWN";
      setHealth(status === "UP" ? "up" : "down");
      setHealthMessage(`Backend health: ${status}`);
      setModelStatus(model);
    } catch (error) {
      setHealth("down");
      setHealthMessage(getErrorMessage(error));
    }
  }, [api]);

  return {health, healthMessage, modelStatus, setModelStatus, checkHealth};
}

import {useCallback, useState} from "react";

import type {ApiClient} from "../api";
import type {ModelStatusResponse} from "../types";

export function useModelConfig({api}: {api: ApiClient}) {
  const [health, setHealth] = useState<"checking" | "up" | "down">("checking");
  const [healthMessage, setHealthMessage] = useState("正在连接灵犀…");
  const [modelStatus, setModelStatus] = useState<ModelStatusResponse | null>(null);

  const checkHealth = useCallback(async () => {
    setHealth("checking");
    setHealthMessage("正在连接灵犀…");
    try {
      const [healthResult, model] = await Promise.all([api.health(), api.modelStatus()]);
      const status = healthResult.status ?? "UNKNOWN";
      setHealth(status === "UP" ? "up" : "down");
      setHealthMessage(status === "UP" ? "灵犀已连接" : "灵犀暂时连不上");
      setModelStatus(model);
    } catch {
      // Don't leak the raw backend error string into the UI (D10/D12).
      setHealth("down");
      setHealthMessage("灵犀暂时连不上");
    }
  }, [api]);

  return {health, healthMessage, modelStatus, setModelStatus, checkHealth};
}

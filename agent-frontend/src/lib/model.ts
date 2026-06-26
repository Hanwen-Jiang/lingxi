import type {ModelOption, ModelStatusResponse, ReasoningEffort} from "../types";

import {REASONING_EFFORTS} from "./constants";

export type ComposerModel = {
  id: string;
  name: string;
  title: string;
  meta: string;
  provider: string;
  contextWindow: string;
  description: string;
  note: string;
  version: string;
};

export function isGptSeriesModel(model?: string) {
  return model?.trim().toLowerCase().startsWith("gpt") ?? false;
}

export function normalizeReasoningEffort(value?: string | null): ReasoningEffort {
  const normalized = value?.trim().toLowerCase().replace("_", "-");
  if (normalized === "x-high" || normalized === "extra-high") return "xhigh";
  return REASONING_EFFORTS.some((effort) => effort.value === normalized) ? (normalized as ReasoningEffort) : "high";
}

export function reasoningEffortLabel(value?: string | null) {
  const normalized = normalizeReasoningEffort(value);
  return REASONING_EFFORTS.find((effort) => effort.value === normalized)?.label ?? "High";
}

export function compactReasoningEffortLabel(value?: string | null) {
  const normalized = normalizeReasoningEffort(value);
  if (normalized === "xhigh") return "xHigh";
  return normalized;
}

export function modelPickerReasoningLabel(value?: string | null) {
  const normalized = normalizeReasoningEffort(value);
  if (normalized === "low") return "低";
  if (normalized === "medium") return "中";
  if (normalized === "high") return "高";
  if (normalized === "xhigh") return "超高";
  return reasoningEffortLabel(normalized);
}

export function modelPickerModelLabel(model: ComposerModel) {
  return model.id
    .replace(/^gpt/i, "GPT")
    .replace(/(^|-)mini/gi, "$1Mini")
    .replace(/(^|-)codex/gi, "$1Codex")
    .replace(/(^|-)opus/gi, "$1Opus")
    .replace(/(^|-)sonnet/gi, "$1Sonnet")
    .replace(/(^|-)gemini/gi, "$1Gemini");
}

export function supportsOpenAiProtocol(modelStatus: ModelStatusResponse | null) {
  return (modelStatus?.provider ?? "").toLowerCase().includes("openai") || isGptSeriesModel(modelStatus?.model);
}

export function inferProviderLabel(modelStatus: ModelStatusResponse | null) {
  const provider = modelStatus?.provider?.trim();
  const model = modelStatus?.model?.trim().toLowerCase() ?? "";
  if (provider) return provider;
  if (model.startsWith("gpt")) return "OpenAI";
  if (model.includes("qwen")) return "DashScope";
  if (model.includes("claude")) return "Anthropic";
  if (model.includes("gemini")) return "Google";
  return "Backend";
}

export function modelDisplayName(modelId: string) {
  return modelId
    .split(/[-_:]/)
    .filter(Boolean)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join(" ");
}

export function composerModelFromOption(
  option: ModelOption,
  modelStatus: ModelStatusResponse | null,
  reasoning: ReasoningEffort,
): ComposerModel {
  const id = option.id.trim();
  const provider =
    option.ownedBy === "configured"
      ? inferProviderLabel(modelStatus)
      : option.ownedBy || inferProviderLabel(modelStatus);
  const meta = compactReasoningEffortLabel(reasoning);
  return {
    id,
    name: id,
    title: modelDisplayName(id),
    meta,
    provider,
    contextWindow: modelStatus?.maxOutputTokens
      ? `${modelStatus.maxOutputTokens.toLocaleString()} max output tokens`
      : "Runtime configured context",
    description: `${provider} model available through the current backend configuration.`,
    note: option.ownedBy === "configured" ? "Currently configured model." : "Loaded from the upstream model list.",
    version: `${reasoningEffortLabel(reasoning)} reasoning effort`,
  };
}

export function modelOptionsWithCurrent(options: ModelOption[], currentModel?: string) {
  const seen = new Set<string>();
  const merged: ModelOption[] = [];
  const add = (option: ModelOption | null) => {
    const id = option?.id?.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push({...option, id});
  };
  add(currentModel ? {id: currentModel, ownedBy: "configured"} : null);
  options.forEach(add);
  return merged;
}

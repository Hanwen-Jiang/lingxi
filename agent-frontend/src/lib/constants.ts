import {type CSSProperties} from "react";

import type {ChatMode, MemoryType, ReasoningEffort} from "../types";

export const CHAT_MODES: ChatMode[] = [
  {id: "auto", label: "Auto", description: "Backend routing chooses the best capability for each turn.", tone: "chat"},
  {id: "direct", label: "Direct Chat", description: "Single assistant reply.", tone: "chat"},
  {id: "agent", label: "Agent Chat", description: "Agent with tools and memory.", tone: "agent"},
  {id: "adaptive-rag", label: "Adaptive RAG", description: "Planner-backed knowledge answer.", tone: "knowledge"},
  {id: "rag", label: "RAG Chat", description: "Knowledge retrieval answer.", tone: "knowledge"},
  {id: "draft", label: "Reply Draft", description: "Agent-assisted reply drafting.", tone: "agent"},
];

export const SLASH_COMMANDS = ["/direct-chat", "/agent-chat", "/adaptive-rag", "/rag-chat", "/reply-draft", "/streaming-chat"];

export const MEMORY_TYPES: MemoryType[] = [
  "IMPORTANT_FACT",
  "PROJECT_CONTEXT",
  "USER_PREFERENCE",
  "TECH_STACK",
  "OUTPUT_STYLE",
  "REFLECTION",
];

export const TERMINAL_JOB_STATUSES = new Set(["SUCCEEDED", "FAILED"]);

export const COMPOSER_BUTTON_STYLE = {
  "--button-bg": "var(--background)",
  "--button-bg-hover": "var(--default-hover)",
  "--button-bg-pressed": "var(--default-hover)",
  "--button-fg": "var(--foreground)",
} as CSSProperties;

export const MOBILE_NAV_QUERY = "(max-width: 1023px)";

export const REASONING_EFFORTS: {value: ReasoningEffort; label: string}[] = [
  {value: "none", label: "None"},
  {value: "minimal", label: "Minimal"},
  {value: "low", label: "Low"},
  {value: "medium", label: "Medium"},
  {value: "high", label: "High"},
  {value: "xhigh", label: "X High"},
];

export const MODEL_PICKER_REASONING_EFFORTS = REASONING_EFFORTS.filter((effort) =>
  ["low", "medium", "high", "xhigh"].includes(effort.value),
);

export const THEME_STORAGE_KEY = "infinitechat-theme";

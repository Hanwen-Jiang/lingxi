import {type CSSProperties} from "react";

import type {ChatMode, MemoryType, ReasoningEffort} from "../types";

export const CHAT_MODES: ChatMode[] = [
  {id: "auto", label: "自动", description: "灵犀根据问题自动挑选合适的方式回答。", tone: "chat"},
  {id: "direct", label: "直接对话", description: "纯粹的对话回复。", tone: "chat"},
  {id: "agent", label: "智能助理", description: "调用工具、用上长期记忆。", tone: "agent"},
  {id: "adaptive-rag", label: "智能查阅", description: "自动规划知识检索。", tone: "knowledge"},
  {id: "rag", label: "知识问答", description: "从你的知识库里找答案。", tone: "knowledge"},
  {id: "draft", label: "起草回复", description: "灵犀帮你起草一段回复。", tone: "agent"},
];

export const SLASH_COMMANDS = [
  "/direct-chat",
  "/agent-chat",
  "/adaptive-rag",
  "/rag-chat",
  "/reply-draft",
  "/streaming-chat",
];

export const MEMORY_TYPES: MemoryType[] = [
  "IMPORTANT_FACT",
  "PROJECT_CONTEXT",
  "USER_PREFERENCE",
  "TECH_STACK",
  "OUTPUT_STYLE",
  "REFLECTION",
];

// User-facing labels for memory categories — the enum strings are wire values
// the backend stores, so we translate at the UI edge only.
export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  IMPORTANT_FACT: "重要事实",
  PROJECT_CONTEXT: "项目背景",
  USER_PREFERENCE: "个人偏好",
  TECH_STACK: "技术栈",
  OUTPUT_STYLE: "输出风格",
  REFLECTION: "反思总结",
};

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

import {Bot, Database, MessageSquare} from "lucide-react";

import {ApiError} from "../api";
import type {
  AutoRouteId,
  ChatMode,
  ChatModeId,
  ChatTurnSummary,
  DocumentIngestJobResponse,
  MessageStatus,
  WorkspaceMessage,
} from "../types";

import {CHAT_MODES, TERMINAL_JOB_STATUSES} from "./constants";
import {getObjectValue, parseMetadataJson, stringifyDetail} from "./format";

export type TraceStep = {
  label: string;
  detail?: string;
};

export function isTerminalJob(job: DocumentIngestJobResponse) {
  return TERMINAL_JOB_STATUSES.has(job.status);
}

export function statusTone(status?: MessageStatus | string) {
  if (status === "error" || status === "ERROR") return "danger";
  if (status === "streaming" || status === "sending") return "warning";
  return "success";
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Request failed";
}

export function friendlyError(message: string) {
  if (message.includes("DASHSCOPE_API_KEY") || message.includes("AI 模型未配置")) {
    return "AI model is not configured yet. Set a model key in the backend, then retry this message.";
  }
  return message;
}

export function modeIcon(mode: ChatMode) {
  if (mode.tone === "agent") return Bot;
  if (mode.tone === "knowledge") return Database;
  return MessageSquare;
}

export function modeLabel(modeId?: string) {
  return CHAT_MODES.find((mode) => mode.id === modeId)?.label ?? "Chat";
}

export function routeLabel(route?: AutoRouteId | string) {
  if (!route) return "Auto";
  return CHAT_MODES.find((mode) => mode.id === route)?.label ?? route;
}

export function routeModeId(route?: AutoRouteId | string): ChatModeId {
  if (route === "direct" || route === "chat" || route === "stream") return "direct";
  if (route === "agent") return "agent";
  if (route === "adaptive-rag") return "adaptive-rag";
  if (route === "rag") return "rag";
  if (route === "draft") return "draft";
  return "auto";
}

export function extractTraceSteps(meta?: Record<string, unknown>): TraceStep[] {
  const steps: TraceStep[] = [];
  if (!meta) return steps;

  const route = getObjectValue(meta, "route");
  const reason = getObjectValue(meta, "reason");
  if (route || reason) {
    steps.push({
      label: route ? `Route: ${routeLabel(String(route))}` : "Route selected",
      detail: typeof reason === "string" ? reason : stringifyDetail(reason),
    });
  }

  const trace = getObjectValue(meta, "toolTrace") ?? getObjectValue(getObjectValue(meta, "details"), "toolTrace");
  const nestedTrace = getObjectValue(trace, "toolTrace") ?? trace;
  const capability = getObjectValue(nestedTrace, "capability");
  if (capability) {
    steps.push({label: `Capability: ${String(capability)}`, detail: stringifyDetail(nestedTrace)});
  } else if (nestedTrace && Object.keys(nestedTrace as Record<string, unknown>).length) {
    steps.push({label: "Backend trace", detail: stringifyDetail(nestedTrace)});
  }

  return steps;
}

export function messageFromTurn(turn: ChatTurnSummary): WorkspaceMessage[] {
  const meta = parseMetadataJson(turn.metadataJson);
  return [
    {
      id: `turn-${turn.id}-user`,
      role: "user",
      content: turn.prompt,
      status: "complete",
      modeId: routeModeId(turn.mode),
    },
    {
      id: `turn-${turn.id}-assistant`,
      role: "assistant",
      content: turn.status === "ERROR" ? friendlyError(turn.errorMessage ?? "Request failed") : turn.answer ?? "",
      status: turn.status === "ERROR" ? "error" : "complete",
      modeId: routeModeId(turn.mode),
      requestId: turn.requestId,
      meta,
    },
  ];
}

import {useCallback, useRef, useState} from "react";

import type {ApiClient} from "../api";
import {extractPendingTools, friendlyError, getErrorMessage, routeModeId} from "../lib/chat";
import {STREAMING_CHAT_MODES} from "../lib/constants";
import {makeId} from "../lib/format";
import type {AutoChatResponse, ChatModeId, ChatRequest, ChatStatus, Citation, WorkspaceMessage} from "../types";

// What every synchronous (non-streaming) mode resolves to: the answer text plus
// optional citations and a mode-specific meta blob (route/strategy/tool trace)
// that MessageTimeline surfaces. Normalizing here lets sendPrompt stay agnostic
// to which endpoint produced the answer.
type SyncModeResult = {
  answer: string;
  citations?: Citation[];
  meta?: Record<string, unknown>;
};

export function useChat({
  api,
  userId,
  sessionId,
  mode = "auto",
  onSettled,
}: {
  api: ApiClient;
  userId: number;
  sessionId: number;
  mode?: ChatModeId;
  onSettled: (sessionId: number) => void;
}) {
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [status, setChatStatus] = useState<ChatStatus>("ready");
  const [lastRouteResult, setLastRouteResult] = useState<AutoChatResponse | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // The original request behind each assistant turn that is holding tools for
  // confirmation (M4), keyed by assistant message id. confirmTools replays it
  // with the user-approved confirmedTools[].
  const pendingPayloadsRef = useRef<Map<string, ChatRequest>>(new Map());

  const updateMessage = useCallback((id: string, patch: Partial<WorkspaceMessage>) => {
    setMessages((current) => current.map((message) => (message.id === id ? {...message, ...patch} : message)));
  }, []);

  const appendAssistantContent = useCallback((id: string, text: string) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? {...message, content: `${message.content}${text}`} : message)),
    );
  }, []);

  // Dispatch a synchronous mode to its real backend endpoint (M3). Each endpoint
  // returns a different DTO; we flatten them to a common {answer, citations,
  // meta} shape. Until M14 these all answer in one frame — there is no token
  // stream — so the caller renders the whole answer at once.
  const runSyncMode = useCallback(
    async (activeMode: ChatModeId, payload: ChatRequest): Promise<SyncModeResult> => {
      switch (activeMode) {
        case "agent": {
          const res = await api.agentChat(payload);
          const pendingTools = extractPendingTools(res.toolGovernance);
          return {
            answer: res.answer ?? "",
            citations: res.citations,
            meta: {
              route: "agent",
              ...(res.strategy ? {strategy: res.strategy} : {}),
              ...(res.finalAction ? {finalAction: res.finalAction} : {}),
              ...(res.reactTrace ? {toolTrace: res.reactTrace} : {}),
              ...(pendingTools.length ? {pendingTools} : {}),
            },
          };
        }
        case "rag": {
          const res = await api.ragChat(payload);
          return {
            answer: res.answer ?? "",
            citations: res.citations,
            meta: {route: "rag", ...(res.hit !== undefined ? {hit: res.hit} : {})},
          };
        }
        case "adaptive-rag": {
          const res = await api.adaptiveRagChat(payload);
          return {
            answer: res.answer ?? "",
            citations: res.citations,
            meta: {
              route: "adaptive-rag",
              ...(res.strategy ? {strategy: res.strategy} : {}),
              ...(res.rounds !== undefined ? {rounds: res.rounds} : {}),
            },
          };
        }
        // "direct" and "draft" both ride the generic /chat endpoint — there is no
        // dedicated draft endpoint yet (S1 handoff), so draft behaves as a plain
        // direct turn for now while keeping its own route label.
        case "direct":
        case "draft":
        default: {
          const res = await api.chat(payload);
          return {answer: res.answer ?? "", meta: {route: activeMode}};
        }
      }
    },
    [api],
  );

  // The auto router is the only mode that streams (over /chat/auto/stream). The
  // per-event wiring is unchanged from when this was the only path.
  const streamAutoMode = useCallback(
    async (assistantId: string, payload: ChatRequest) => {
      let requestFailed = false;

      abortRef.current?.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;
      await api.autoStreamChat(
        payload,
        (event) => {
          if (event.requestId || event.route) {
            const routeResult: AutoChatResponse = {
              route: routeModeId(event.route),
              forced: event.forced ?? false,
              reason: event.reason,
              requestId: event.requestId,
              status: event.type === "error" ? "ERROR" : "SUCCESS",
              citations: event.citations,
              toolTrace: event.toolTrace,
            };
            setLastRouteResult(routeResult);
            updateMessage(assistantId, {
              requestId: event.requestId,
              modeId: routeModeId(event.route),
              citations: event.citations,
              meta: {
                ...(event.reason ? {reason: event.reason} : {}),
                ...(event.route ? {route: event.route, forced: event.forced ?? false} : {}),
                ...(event.toolTrace ? {toolTrace: event.toolTrace} : {}),
              },
            });
          }
          if (event.type === "delta" && event.text) {
            appendAssistantContent(assistantId, event.text);
          }
          if (event.type === "error") {
            requestFailed = true;
            updateMessage(assistantId, {
              content: friendlyError(event.message ?? "Stream returned an error event."),
              status: "error",
              meta: {
                code: event.code,
                requestId: event.requestId,
                detail: event.message,
                route: event.route,
                forced: event.forced,
              },
            });
            setLastRouteResult({
              route: routeModeId(event.route),
              forced: event.forced ?? false,
              reason: event.reason,
              requestId: event.requestId,
              status: "ERROR",
              errorMessage: event.message,
            });
          }
        },
        abortController.signal,
      );
      if (!requestFailed) {
        updateMessage(assistantId, {status: "complete"});
      }
      setChatStatus(requestFailed ? "error" : "ready");
    },
    [api, appendAssistantContent, updateMessage],
  );

  async function sendPrompt() {
    const trimmed = prompt.trim();
    if (!trimmed || status === "submitted" || status === "streaming") return;

    const userMessage: WorkspaceMessage = {
      id: makeId("user"),
      role: "user",
      content: trimmed,
      status: "complete",
      modeId: mode,
    };
    const assistantId = makeId("assistant");
    const assistantMessage: WorkspaceMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      status: "streaming",
      modeId: mode,
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setPrompt("");
    setChatStatus("streaming");

    const payload: ChatRequest = {userId, sessionId, prompt: trimmed};

    try {
      if (STREAMING_CHAT_MODES.has(mode)) {
        await streamAutoMode(assistantId, payload);
      } else {
        const {answer, citations, meta} = await runSyncMode(mode, payload);
        // If the agent is holding tools for confirmation (M4), remember the
        // request so confirmTools can replay it with the approved subset.
        const pendingTools = meta?.pendingTools;
        if (Array.isArray(pendingTools) && pendingTools.length) {
          pendingPayloadsRef.current.set(assistantId, payload);
        }
        updateMessage(assistantId, {
          content: answer,
          status: "complete",
          modeId: mode,
          ...(citations ? {citations} : {}),
          ...(meta ? {meta} : {}),
        });
        // An explicit mode is a forced route — record it so the composer shows
        // the chosen mode rather than an auto-selected one.
        setLastRouteResult({route: routeModeId(mode), forced: true, status: "SUCCESS"});
        setChatStatus("ready");
      }
    } catch (error) {
      updateMessage(assistantId, {
        content: friendlyError(getErrorMessage(error)),
        status: "error",
      });
      setChatStatus("error");
    } finally {
      abortRef.current = null;
      window.setTimeout(() => onSettled(sessionId), 500);
    }
  }

  // Replay the agent turn with the user-approved tools (M4). The assistant
  // bubble flips to a loader while the confirmed call is in flight, then renders
  // the follow-up answer. If the backend comes back asking for more tools
  // (multi-round governance) the new pending set is stashed again so the card
  // re-appears. confirmedTools[] is the contract field; a future F01 challenge
  // token would ride alongside it here.
  const confirmTools = useCallback(
    async (assistantId: string, selected: string[]) => {
      const payload = pendingPayloadsRef.current.get(assistantId);
      if (!payload) return;

      updateMessage(assistantId, {content: "", status: "streaming"});
      setChatStatus("streaming");
      try {
        const res = await api.agentChat({...payload, confirmedTools: selected});
        const pendingTools = extractPendingTools(res.toolGovernance);
        if (pendingTools.length) {
          pendingPayloadsRef.current.set(assistantId, payload);
        } else {
          pendingPayloadsRef.current.delete(assistantId);
        }
        updateMessage(assistantId, {
          content: res.answer ?? "",
          status: "complete",
          ...(res.citations ? {citations: res.citations} : {}),
          meta: {
            route: "agent",
            confirmedTools: selected,
            ...(res.strategy ? {strategy: res.strategy} : {}),
            ...(res.reactTrace ? {toolTrace: res.reactTrace} : {}),
            ...(pendingTools.length ? {pendingTools} : {}),
          },
        });
        setChatStatus("ready");
      } catch (error) {
        pendingPayloadsRef.current.delete(assistantId);
        updateMessage(assistantId, {content: friendlyError(getErrorMessage(error)), status: "error"});
        setChatStatus("error");
      }
    },
    [api, updateMessage],
  );

  function stopStream() {
    abortRef.current?.abort();
    abortRef.current = null;
    setChatStatus("ready");
  }

  return {
    messages,
    setMessages,
    prompt,
    setPrompt,
    status,
    lastRouteResult,
    setLastRouteResult,
    sendPrompt,
    confirmTools,
    stopStream,
  };
}

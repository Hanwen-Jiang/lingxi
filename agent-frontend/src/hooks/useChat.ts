import {useCallback, useRef, useState} from "react";

import type {ApiClient} from "../api";
import {extractChallengeToken, extractPendingTools, friendlyError, getErrorMessage, routeModeId} from "../lib/chat";
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
  userId: string;
  sessionId: string;
  mode?: ChatModeId;
  onSettled: (sessionId: string) => void;
}) {
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [status, setChatStatus] = useState<ChatStatus>("ready");
  const [lastRouteResult, setLastRouteResult] = useState<AutoChatResponse | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Per-assistant-turn replay context for M4 (F01). Stores the original
  // ChatRequest plus the one-shot challengeToken the server handed back — the
  // user's confirmation just decides to release the token; the prompt and
  // session are already fingerprinted into it.
  type PendingTurn = {payload: ChatRequest; challengeToken: string; expiresInSec?: number};
  const pendingPayloadsRef = useRef<Map<string, PendingTurn>>(new Map());

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
          const challenge = extractChallengeToken(res.toolGovernance);
          const pendingTools = extractPendingTools(res.toolGovernance);
          return {
            answer: res.answer ?? "",
            citations: res.citations,
            meta: {
              route: "agent",
              ...(res.strategy ? {strategy: res.strategy} : {}),
              ...(res.finalAction ? {finalAction: res.finalAction} : {}),
              ...(res.reactTrace ? {toolTrace: res.reactTrace} : {}),
              // Only surface the confirmation card when the server actually
              // issued a challenge — bare pendingTools without a token can't
              // be released (F01 ignores client-supplied tool names).
              ...(challenge ? {challenge, pendingTools} : {}),
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
        // If the agent is holding the turn for confirmation (M4 / F01), stash
        // the original payload + the challenge token so confirmTurn can
        // release it. No token → nothing to release, even if pendingTools
        // is non-empty (F01 only honours the token).
        const challenge = meta?.challenge as {challengeToken?: string; expiresInSec?: number} | undefined;
        if (challenge?.challengeToken) {
          pendingPayloadsRef.current.set(assistantId, {
            payload,
            challengeToken: challenge.challengeToken,
            expiresInSec: challenge.expiresInSec,
          });
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

  // Release a held agent turn (M4 / F01). Echoes the server-issued
  // challengeToken back as `confirmationToken`; the user's "确认" press just
  // decides to release the token. Multi-round governance still works: if the
  // backend issues a fresh token after the first round (e.g. asks about a
  // follow-up tool), the new {payload, token} replaces the old entry and the
  // confirmation card re-appears. The card's "全部跳过" path passes
  // shouldRelease=false so the assistant turn ends in place without sending
  // any token (the held turn naturally falls off TTL on the server).
  const confirmTurn = useCallback(
    async (assistantId: string, shouldRelease = true) => {
      const pending = pendingPayloadsRef.current.get(assistantId);
      if (!pending) return;

      if (!shouldRelease) {
        // User declined to release the held turn. Drop the pending state and
        // surface a calm note in the bubble.
        pendingPayloadsRef.current.delete(assistantId);
        updateMessage(assistantId, {
          content: "已取消工具调用。",
          status: "complete",
          meta: {route: "agent", confirmationCancelled: true},
        });
        setChatStatus("ready");
        return;
      }

      updateMessage(assistantId, {content: "", status: "streaming"});
      setChatStatus("streaming");
      try {
        const res = await api.agentChat({...pending.payload, confirmationToken: pending.challengeToken});
        const challenge = extractChallengeToken(res.toolGovernance);
        const pendingTools = extractPendingTools(res.toolGovernance);
        if (challenge?.challengeToken) {
          pendingPayloadsRef.current.set(assistantId, {
            payload: pending.payload,
            challengeToken: challenge.challengeToken,
            expiresInSec: challenge.expiresInSec,
          });
        } else {
          pendingPayloadsRef.current.delete(assistantId);
        }
        updateMessage(assistantId, {
          content: res.answer ?? "",
          status: "complete",
          ...(res.citations ? {citations: res.citations} : {}),
          meta: {
            route: "agent",
            confirmationApplied: true,
            ...(res.strategy ? {strategy: res.strategy} : {}),
            ...(res.reactTrace ? {toolTrace: res.reactTrace} : {}),
            ...(challenge ? {challenge, pendingTools} : {}),
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
    confirmTurn,
    stopStream,
  };
}

import {useCallback, useRef, useState} from "react";

import type {ApiClient} from "../api";
import {friendlyError, getErrorMessage, routeModeId} from "../lib/chat";
import {makeId} from "../lib/format";
import type {AutoChatResponse, ChatStatus, WorkspaceMessage} from "../types";

export function useChat({
  api,
  userId,
  sessionId,
  onSettled,
}: {
  api: ApiClient;
  userId: number;
  sessionId: number;
  onSettled: (sessionId: number) => void;
}) {
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [status, setChatStatus] = useState<ChatStatus>("ready");
  const [lastRouteResult, setLastRouteResult] = useState<AutoChatResponse | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const updateMessage = useCallback((id: string, patch: Partial<WorkspaceMessage>) => {
    setMessages((current) => current.map((message) => (message.id === id ? {...message, ...patch} : message)));
  }, []);

  const appendAssistantContent = useCallback((id: string, text: string) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? {...message, content: `${message.content}${text}`} : message)),
    );
  }, []);

  async function sendPrompt() {
    const trimmed = prompt.trim();
    if (!trimmed || status === "submitted" || status === "streaming") return;

    const userMessage: WorkspaceMessage = {
      id: makeId("user"),
      role: "user",
      content: trimmed,
      status: "complete",
      modeId: "auto",
    };
    const assistantId = makeId("assistant");
    const assistantMessage: WorkspaceMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      status: "streaming",
      modeId: "auto",
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setPrompt("");
    setChatStatus("streaming");

    const payload = {userId, sessionId, prompt: trimmed};

    try {
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
              meta: {code: event.code, requestId: event.requestId, detail: event.message, route: event.route, forced: event.forced},
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

  function stopStream() {
    abortRef.current?.abort();
    abortRef.current = null;
    setChatStatus("ready");
  }

  return {messages, setMessages, prompt, setPrompt, status, lastRouteResult, setLastRouteResult, sendPrompt, stopStream};
}

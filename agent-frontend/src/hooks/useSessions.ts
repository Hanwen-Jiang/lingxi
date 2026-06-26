import {useCallback, useMemo, useState} from "react";

import type {ApiClient} from "../api";
import {messageFromTurn, modeLabel, routeModeId} from "../lib/chat";
import type {ChatSessionSummary, ChatTurnSummary} from "../types";

import type {useChat} from "./useChat";

export function useSessions({
  api,
  userId,
  sessionId,
  setSessionId,
  chat,
}: {
  api: ApiClient;
  userId: number;
  sessionId: number;
  setSessionId: (id: number) => void;
  chat: Pick<ReturnType<typeof useChat>, "setMessages" | "setPrompt" | "setLastRouteResult">;
}) {
  // Stable useState setters from the chat hook — depend on these (not the
  // freshly-rebuilt `chat` object) so loadSession keeps a stable identity.
  const {setMessages: setChatMessages, setPrompt: setChatPrompt, setLastRouteResult: setChatLastRouteResult} = chat;

  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSessionSummary | null>(null);
  const [turns, setTurns] = useState<ChatTurnSummary[]>([]);
  const [sessionQuery, setSessionQuery] = useState("");

  const filteredSessions = useMemo(() => {
    const query = sessionQuery.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) =>
      [session.title, session.summary, modeLabel(session.mode)].some((value) =>
        (value ?? "").toLowerCase().includes(query),
      ),
    );
  }, [sessionQuery, sessions]);

  const refreshSessions = useCallback(async () => {
    const items = await api.listSessions(userId, 60);
    setSessions(items);
    setSelectedSession(
      (current) => items.find((item) => item.sessionId === (current?.sessionId ?? sessionId)) ?? current,
    );
  }, [api, sessionId, userId]);

  const loadSession = useCallback(
    async (targetSessionId: number) => {
      const detail = await api.getSession(userId, targetSessionId);
      setSelectedSession(detail.session);
      setSessionId(detail.session.sessionId);
      setTurns(detail.turns);
      setChatMessages(detail.turns.flatMap(messageFromTurn));
      const lastTurn = [...detail.turns].reverse().find((turn) => turn.requestId);
      setChatLastRouteResult(
        lastTurn
          ? {
              route: routeModeId(lastTurn.mode),
              forced: lastTurn.metadataJson?.includes('"forced":true') ?? false,
              reason: lastTurn.metadataJson ? "Loaded from session history." : undefined,
              requestId: lastTurn.requestId,
              status: lastTurn.status,
            }
          : null,
      );
    },
    [api, userId, setSessionId, setChatMessages, setChatLastRouteResult],
  );

  async function startNewSession() {
    const nextSessionId = Date.now();
    const session = await api.createSession({
      userId,
      sessionId: nextSessionId,
      mode: "auto",
      title: "New conversation",
    });
    setSessionId(session.sessionId);
    setSelectedSession(session);
    setTurns([]);
    setChatMessages([]);
    setChatPrompt("");
    setChatLastRouteResult(null);
    await refreshSessions();
  }

  // Sync a SPECIFIC session (the one active when a prompt was sent), so a
  // post-stream refresh targets the originally-sent session even if the user
  // has since switched away.
  async function syncSession(targetSessionId: number) {
    await refreshSessions();
    await loadSession(targetSessionId);
  }

  return {
    sessions,
    setSessions,
    selectedSession,
    setSelectedSession,
    turns,
    sessionQuery,
    setSessionQuery,
    filteredSessions,
    refreshSessions,
    loadSession,
    startNewSession,
    syncSession,
  };
}

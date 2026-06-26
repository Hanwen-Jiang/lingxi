import {useEffect, useMemo, useRef, useState} from "react";
import {AnimatePresence} from "motion/react";

import {Sidebar} from "@heroui-pro/react/sidebar";

import {createApiClient, getDefaultApiBase} from "./api";
import {AnimatedWorkspaceView} from "./components/AnimatedWorkspaceView";
import {useChat} from "./hooks/useChat";
import {useIngestion} from "./hooks/useIngestion";
import {useMemory} from "./hooks/useMemory";
import {useModelConfig} from "./hooks/useModelConfig";
import {useSessions} from "./hooks/useSessions";
import {CHAT_MODES} from "./lib/constants";
import {readStorage, STORAGE_KEYS, writeStorage} from "./lib/storage";
import {ChatHeader} from "./features/chat/ChatHeader";
import {ComposerDock} from "./features/chat/ComposerDock";
import {MessageTimeline} from "./features/chat/MessageTimeline";
import {SessionInsightPanel} from "./features/insight/SessionInsightPanel";
import {SessionList} from "./features/sessions/SessionList";
import {SettingsWorkspace} from "./features/settings/SettingsWorkspace";
import {GlobalSidebar} from "./features/sidebar/GlobalSidebar";

// Resolve the starting session id. A valid finite number persisted in storage
// is restored (and reported as `restored: true` so the init effect can reopen
// that conversation); otherwise we mint a fresh id. Storage access is guarded
// inside readStorage, so this never throws.
function resolveInitialSession(): {id: number; restored: boolean} {
  const stored = readStorage(STORAGE_KEYS.lastSessionId);
  if (stored !== null) {
    const parsed = Number(stored);
    if (Number.isFinite(parsed)) return {id: parsed, restored: true};
  }
  return {id: Date.now(), restored: false};
}

export function App() {
  const [apiBase] = useState(() => readStorage(STORAGE_KEYS.apiBase) ?? getDefaultApiBase());
  const [userId] = useState(1);
  // Computed once on mount; `restored` tells the init effect whether to reopen
  // the persisted conversation.
  const [initialSession] = useState(resolveInitialSession);
  const [sessionId, setSessionId] = useState(initialSession.id);
  const [view, setView] = useState<"chat" | "settings">("chat");
  const api = useMemo(() => createApiClient(apiBase), [apiBase]);
  const activeMode = CHAT_MODES[0];

  const model = useModelConfig({api});
  const ingestion = useIngestion({api});
  const memory = useMemory({api, userId});
  const sessionsRef = useRef<ReturnType<typeof useSessions> | null>(null);
  const chat = useChat({
    api,
    userId,
    sessionId,
    onSettled: (sentSessionId) => sessionsRef.current?.syncSession(sentSessionId),
  });
  const sessions = useSessions({api, userId, sessionId, setSessionId, chat});

  useEffect(() => {
    sessionsRef.current = sessions;
  });

  // Pull the stable (useCallback-memoized) actions out so the init effect can
  // depend on plain identifiers rather than the freshly-rebuilt hook objects.
  const {checkHealth} = model;
  const {refreshSessions, loadSession} = sessions;

  useEffect(() => {
    void checkHealth();
    void (async () => {
      try {
        await refreshSessions();
        // Reopen the persisted conversation if it was restored from storage and
        // still exists; loadSession throws for a missing/deleted session, which
        // we swallow so the app stays on a fresh session instead of crashing.
        if (initialSession.restored) {
          await loadSession(initialSession.id);
        }
      } catch {
        // Degrade gracefully: keep the fresh session already in state.
      }
    })();
  }, [initialSession, checkHealth, refreshSessions, loadSession]);

  // Persist apiBase and the active sessionId so a reload restores the same
  // backend target and conversation. Writes are guarded inside writeStorage.
  useEffect(() => {
    writeStorage(STORAGE_KEYS.apiBase, apiBase);
  }, [apiBase]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.lastSessionId, String(sessionId));
  }, [sessionId]);

  return (
    <Sidebar.Provider collapsible="offcanvas" reduceMotion toggleShortcut={false}>
      <div className="flex h-svh w-full min-w-0 overflow-hidden bg-background text-foreground">
        <GlobalSidebar health={model.health} view={view} onNavigate={setView} />
        <Sidebar.Main className="min-w-0 flex-1">
          <AnimatePresence initial={false} mode="wait">
            <AnimatedWorkspaceView key={view} direction={view === "settings" ? 1 : -1}>
              {view === "settings" ? (
                <SettingsWorkspace
                  api={api}
                  apiBase={apiBase}
                  health={model.health}
                  healthMessage={model.healthMessage}
                  jobs={ingestion.jobs}
                  memoryItems={memory.memoryItems}
                  modelStatus={model.modelStatus}
                  sessionId={sessionId}
                  userId={userId}
                  onBack={() => setView("chat")}
                  onCheckHealth={model.checkHealth}
                  onJob={ingestion.addJob}
                  onMemoryItems={memory.setMemoryItems}
                  onModelStatus={model.setModelStatus}
                  onNavigate={setView}
                  onRefreshMemories={() => void memory.refreshMemories()}
                />
              ) : (
                <div className="grid h-svh min-w-0 grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
                  <SessionList
                    activeSessionId={sessionId}
                    query={sessions.sessionQuery}
                    sessions={sessions.filteredSessions}
                    totalSessions={sessions.sessions.length}
                    onNewSession={() => void sessions.startNewSession()}
                    onQueryChange={sessions.setSessionQuery}
                    onRefresh={() => void sessions.refreshSessions()}
                    onSelect={(target) => void sessions.loadSession(target)}
                  />
                  <main className="grid min-h-0 min-w-0 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_340px]">
                    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                      <ChatHeader
                        activeSessionId={sessionId}
                        activeMode={activeMode}
                        health={model.health}
                        modelStatus={model.modelStatus}
                        query={sessions.sessionQuery}
                        session={sessions.selectedSession}
                        sessions={sessions.filteredSessions}
                        totalSessions={sessions.sessions.length}
                        onCheckHealth={model.checkHealth}
                        onNavigate={setView}
                        onNewSession={() => void sessions.startNewSession()}
                        onOpenSettings={() => setView("settings")}
                        onQueryChange={sessions.setSessionQuery}
                        onRefreshSessions={() => void sessions.refreshSessions()}
                        onSelectSession={(target) => void sessions.loadSession(target)}
                      />
                      <MessageTimeline messages={chat.messages} />
                      <ComposerDock
                        api={api}
                        lastRouteResult={chat.lastRouteResult}
                        modelStatus={model.modelStatus}
                        prompt={chat.prompt}
                        status={chat.status}
                        onJob={ingestion.addJob}
                        onModelStatus={model.setModelStatus}
                        onPromptChange={chat.setPrompt}
                        onSend={() => void chat.sendPrompt()}
                        onStop={chat.stopStream}
                      />
                    </section>
                    <SessionInsightPanel
                      modelStatus={model.modelStatus}
                      session={sessions.selectedSession}
                      turns={sessions.turns}
                      onSummarize={() =>
                        void api
                          .summarizeSession(userId, sessionId)
                          .then((session) => sessions.setSelectedSession(session))
                      }
                    />
                  </main>
                </div>
              )}
            </AnimatedWorkspaceView>
          </AnimatePresence>
        </Sidebar.Main>
      </div>
    </Sidebar.Provider>
  );
}

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {AnimatePresence} from "motion/react";

import {Sidebar} from "@heroui-pro/react/sidebar";

import {ApiError, createApiClient, getDefaultApiBase} from "./api";
import {AnimatedWorkspaceView} from "./components/AnimatedWorkspaceView";
import {AuthScreen, RESEND_COOLDOWN_SECONDS, type AuthMode} from "./features/auth/AuthScreen";
import {useAuth} from "./hooks/useAuth";
import {useChat} from "./hooks/useChat";
import {useIngestion} from "./hooks/useIngestion";
import {useMemory} from "./hooks/useMemory";
import {useModelConfig} from "./hooks/useModelConfig";
import {useSessions} from "./hooks/useSessions";
import {authStore, isAdmin as computeIsAdmin} from "./lib/auth";
import {CHAT_MODES} from "./lib/constants";
import {readStorage, STORAGE_KEYS, writeStorage} from "./lib/storage";
import type {ChatModeId} from "./types";
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

// Per D5, contract §5, user/session ids are string-encoded snowflakes on the
// wire. The hooks currently still expect number — that's an expand/contract
// step S1/S3 will翻 across the stack; until then we coerce at the auth edge.
// A non-numeric snowflake (e.g. "9007199…") would lose precision, but the
// alternative — flipping the whole id type today — is the breaking change the
// plan defers until S1/S3 翻 D5. The fallback keeps the legacy fixture working.
function userIdToNumber(id: string): number {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function App() {
  const [apiBase] = useState(() => readStorage(STORAGE_KEYS.apiBase) ?? getDefaultApiBase());

  // The api client needs to read the current access token on every request
  // and notify us when a request comes back 401 / 40100. We keep it stable
  // across renders (the apiBase rarely changes) and route both through
  // authStore — the single source of truth for both the api client and the
  // React layer (useAuth subscribes to the same store). We defer the clear
  // to a microtask so the request that surfaced the 401 still finishes
  // throwing (and any sibling requests in the same tick can settle) before
  // React unmounts the workspace subtree.
  const handleUnauthorized = useCallback(() => {
    queueMicrotask(() => authStore.clear());
  }, []);

  const api = useMemo(
    () =>
      createApiClient(apiBase, {
        getAccessToken: () => authStore.get().accessToken,
        getRefreshToken: () => authStore.get().refreshToken,
        // Persist refreshed tokens into authStore so subsequent requests pick
        // them up via getAccessToken — the api client only sees what authStore
        // holds. Roles are re-parsed from the new JWT in applyRefresh.
        onRefreshed: (res) =>
          authStore.applyRefresh({
            accessToken: res.token,
            refreshToken: res.refreshToken ?? null,
          }),
        onUnauthorized: handleUnauthorized,
      }),
    [apiBase, handleUnauthorized],
  );

  const auth = useAuth(api);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [codeNotice, setCodeNotice] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown ticks down once per second. The send-mail handler kicks
  // it to RESEND_COOLDOWN_SECONDS; the user sees a live "Ns 后可重发" label.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setInterval(() => setResendCooldown((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, [resendCooldown]);

  // Map backend errors → calm, user-facing strings. Per D4/D10 we never echo
  // raw backend wording; per S3 unit1b 401 is now a real HTTP status (not
  // 200+code), so we branch on both for the {0,200}↔real-HTTP transition.
  // `mode` lets us tailor the password-mismatch wording (registration uses
  // different copy).
  const mapAuthError = (error: unknown, mode: AuthMode): string => {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.code === 40100) {
        return mode === "code" ? "验证码不对,或者已经过期。" : "邮箱或密码不对。";
      }
      if (error.status === 429 || error.code === 42900) {
        return "尝试太频繁,稍等一下再试。";
      }
      if (error.status === 422 || error.code === 42200) {
        return error.message || "请检查填写的信息是否正确。";
      }
      if (error.status === 409 || error.code === 40900) {
        return "这个邮箱已经注册过了,试试直接登录。";
      }
    }
    if (error instanceof Error) return error.message;
    return mode === "register" ? "注册没成功,请重试。" : "登录没成功,请重试。";
  };

  const handleSendCode = useCallback(
    async (email: string) => {
      setAuthError(null);
      setCodeNotice(null);
      try {
        await auth.sendMail(email);
        setCodeNotice(`验证码已发送到 ${email},${RESEND_COOLDOWN_SECONDS} 秒后可重发。`);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      } catch (error) {
        // Reuse the same mapper — sendMail can 429/422 too. Code-mode wording
        // is fine here (sendMail context is the code/register flows).
        setAuthError(mapAuthError(error, "code"));
      }
    },
    [auth],
  );

  const handleLoginPassword = useCallback(
    async (input: {email: string; password: string}) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        await auth.loginPassword(input);
      } catch (error) {
        setAuthError(mapAuthError(error, "password"));
      } finally {
        setAuthBusy(false);
      }
    },
    [auth],
  );

  const handleLoginCode = useCallback(
    async (input: {email: string; code: string}) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        await auth.loginCode(input);
      } catch (error) {
        setAuthError(mapAuthError(error, "code"));
      } finally {
        setAuthBusy(false);
      }
    },
    [auth],
  );

  const handleRegister = useCallback(
    async (input: {email: string; password: string; code: string}) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        await auth.register(input);
      } catch (error) {
        setAuthError(mapAuthError(error, "register"));
      } finally {
        setAuthBusy(false);
      }
    },
    [auth],
  );

  // Toggling between login (password/code) and register clears stale
  // banners so the user isn't reading an error from a different flow.
  const handleModeChange = useCallback(() => {
    setAuthError(null);
    setCodeNotice(null);
  }, []);

  // Persist apiBase so a reload restores the same backend target. (sessionId
  // is persisted by the Workspace shell, scoped to the logged-in user.)
  useEffect(() => {
    writeStorage(STORAGE_KEYS.apiBase, apiBase);
  }, [apiBase]);

  // Until the auth contract is fully wired we gate the entire workspace behind
  // login. Per D10/D12 this is the only thing an unauthenticated user sees.
  if (!auth.isAuthenticated || !auth.user) {
    return (
      <AuthScreen
        busy={authBusy}
        codeNotice={codeNotice}
        errorMessage={authError}
        resendCooldown={resendCooldown}
        onLoginCode={(input) => void handleLoginCode(input)}
        onLoginPassword={(input) => void handleLoginPassword(input)}
        onModeChange={handleModeChange}
        onRegister={(input) => void handleRegister(input)}
        onSendCode={(email) => void handleSendCode(email)}
      />
    );
  }

  // D10 — admin gate for model-config + runtime-context panels. We derive it
  // from the JWT `roles` claim parsed at login. `VITE_DEV_ASSUME_ADMIN=true`
  // is a dev-only override so we can exercise the admin UI locally before S3
  // ships the `roles` claim in real tokens; never enable in prod builds.
  const isAdmin = computeIsAdmin(auth.user) || import.meta.env.VITE_DEV_ASSUME_ADMIN === "true";

  return (
    <Workspace
      api={api}
      apiBase={apiBase}
      isAdmin={isAdmin}
      userId={userIdToNumber(auth.user.id)}
      onLogout={auth.logout}
    />
  );
}

function Workspace({
  api,
  apiBase,
  isAdmin,
  userId,
  onLogout,
}: {
  api: ReturnType<typeof createApiClient>;
  apiBase: string;
  isAdmin: boolean;
  userId: number;
  onLogout: () => void;
}) {
  const [initialSession] = useState(resolveInitialSession);
  const [sessionId, setSessionId] = useState(initialSession.id);
  const [view, setView] = useState<"chat" | "settings">("chat");
  // The active chat mode (M3). Drives which backend endpoint useChat dispatches
  // to; defaults to the auto router. Slash commands / the composer mode chip
  // flip it.
  const [mode, setMode] = useState<ChatModeId>("auto");
  const activeMode = CHAT_MODES.find((candidate) => candidate.id === mode) ?? CHAT_MODES[0];

  const model = useModelConfig({api});
  const ingestion = useIngestion({api});
  const memory = useMemory({api, userId});
  const sessionsRef = useRef<ReturnType<typeof useSessions> | null>(null);
  const chat = useChat({
    api,
    userId,
    sessionId,
    mode,
    onSettled: (sentSessionId) => sessionsRef.current?.syncSession(sentSessionId),
  });
  const sessions = useSessions({api, userId, sessionId, setSessionId, chat});

  useEffect(() => {
    sessionsRef.current = sessions;
  });

  const {checkHealth} = model;
  const {refreshSessions, loadSession} = sessions;

  useEffect(() => {
    void checkHealth();
    void (async () => {
      try {
        await refreshSessions();
        if (initialSession.restored) {
          await loadSession(initialSession.id);
        }
      } catch {
        // Degrade gracefully: keep the fresh session already in state.
      }
    })();
  }, [initialSession, checkHealth, refreshSessions, loadSession]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.lastSessionId, String(sessionId));
  }, [sessionId]);

  return (
    <Sidebar.Provider collapsible="offcanvas" reduceMotion toggleShortcut={false}>
      <div className="flex h-svh w-full min-w-0 overflow-hidden bg-background text-foreground">
        <GlobalSidebar health={model.health} view={view} onNavigate={setView} onLogout={onLogout} />
        <Sidebar.Main className="min-w-0 flex-1">
          <AnimatePresence initial={false} mode="wait">
            <AnimatedWorkspaceView key={view} direction={view === "settings" ? 1 : -1}>
              {view === "settings" ? (
                <SettingsWorkspace
                  api={api}
                  apiBase={apiBase}
                  health={model.health}
                  healthMessage={model.healthMessage}
                  isAdmin={isAdmin}
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
                        activeMode={activeMode}
                        api={api}
                        lastRouteResult={chat.lastRouteResult}
                        modelStatus={model.modelStatus}
                        prompt={chat.prompt}
                        status={chat.status}
                        onJob={ingestion.addJob}
                        onModelStatus={model.setModelStatus}
                        onPromptChange={chat.setPrompt}
                        onSelectMode={setMode}
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

import {
  ArrowLeft,
  ArrowUp,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Database,
  Ellipsis,
  FileInput,
  FileUp,
  Gauge,
  HeartPulse,
  MessageSquare,
  Mic,
  Monitor,
  Moon,
  Sun,
  PanelLeft,
  Plus,
  Route,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  X,
  Upload,
  XCircle,
} from "lucide-react";
import {type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import {AnimatePresence, motion} from "motion/react";

import {Button} from "@heroui/react/button";
import {Chip} from "@heroui/react/chip";
import {Description} from "@heroui/react/description";
import {Input} from "@heroui/react/input";
import {Label} from "@heroui/react/label";
import {ListBox} from "@heroui/react/list-box";
import {Popover} from "@heroui/react/popover";
import {ProgressCircle} from "@heroui/react/progress-circle";
import {ScrollShadow} from "@heroui/react/scroll-shadow";
import {Separator} from "@heroui/react/separator";
import {ChainOfThought} from "@heroui-pro/react/chain-of-thought";
import {ChatAttachment, ChatAttachmentGroup, ChatAttachmentInput, inferChatAttachmentMediaType} from "@heroui-pro/react/chat-attachment";
import {ChatConversation} from "@heroui-pro/react/chat-conversation";
import {ChatListView} from "@heroui-pro/react/chat-list-view";
import {ChatLoader} from "@heroui-pro/react/chat-loader";
import {ChatMessage} from "@heroui-pro/react/chat-message";
import {ChatMessageActions} from "@heroui-pro/react/chat-message-actions";
import {ChatSource, ChatSources} from "@heroui-pro/react/chat-source";
import {ChatTool, ChatToolGroup} from "@heroui-pro/react/chat-tool";
import {CodeBlock} from "@heroui-pro/react/code-block";
import {Markdown} from "@heroui-pro/react/markdown";
import {NativeSelect} from "@heroui-pro/react/native-select";
import {PromptInput} from "@heroui-pro/react/prompt-input";
import {Sheet} from "@heroui-pro/react/sheet";
import {Sidebar} from "@heroui-pro/react/sidebar";
import {TextShimmer} from "@heroui-pro/react/text-shimmer";

import {ApiError, createApiClient, getDefaultApiBase} from "./api";
import type {
  ChatMode,
  ChatModeId,
  AutoChatResponse,
  AutoRouteId,
  ChatSessionSummary,
  ChatTurnSummary,
  Citation,
  DocumentIngestJobResponse,
  MemoryItem,
  MemoryType,
  MessageStatus,
  ModelOption,
  ModelStatusResponse,
  ReasoningEffort,
  WorkspaceMessage,
} from "./types";

const CHAT_MODES: ChatMode[] = [
  {id: "auto", label: "Auto", description: "Backend routing chooses the best capability for each turn.", tone: "chat"},
  {id: "direct", label: "Direct Chat", description: "Single assistant reply.", tone: "chat"},
  {id: "agent", label: "Agent Chat", description: "Agent with tools and memory.", tone: "agent"},
  {id: "adaptive-rag", label: "Adaptive RAG", description: "Planner-backed knowledge answer.", tone: "knowledge"},
  {id: "rag", label: "RAG Chat", description: "Knowledge retrieval answer.", tone: "knowledge"},
  {id: "draft", label: "Reply Draft", description: "Agent-assisted reply drafting.", tone: "agent"},
];

const SLASH_COMMANDS = ["/direct-chat", "/agent-chat", "/adaptive-rag", "/rag-chat", "/reply-draft", "/streaming-chat"];

const MEMORY_TYPES: MemoryType[] = [
  "IMPORTANT_FACT",
  "PROJECT_CONTEXT",
  "USER_PREFERENCE",
  "TECH_STACK",
  "OUTPUT_STYLE",
  "REFLECTION",
];

const TERMINAL_JOB_STATUSES = new Set(["SUCCEEDED", "FAILED"]);

const COMPOSER_BUTTON_STYLE = {
  "--button-bg": "var(--background)",
  "--button-bg-hover": "var(--default-hover)",
  "--button-bg-pressed": "var(--default-hover)",
  "--button-fg": "var(--foreground)",
} as CSSProperties;

const MOBILE_NAV_QUERY = "(max-width: 1023px)";

const REASONING_EFFORTS: {value: ReasoningEffort; label: string}[] = [
  {value: "none", label: "None"},
  {value: "minimal", label: "Minimal"},
  {value: "low", label: "Low"},
  {value: "medium", label: "Medium"},
  {value: "high", label: "High"},
  {value: "xhigh", label: "X High"},
];

const MODEL_PICKER_REASONING_EFFORTS = REASONING_EFFORTS.filter((effort) =>
  ["low", "medium", "high", "xhigh"].includes(effort.value),
);

type ComposerAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType?: string;
  src?: string;
  status?: "uploading" | "ready" | "error";
  message?: string;
  jobId?: string;
};

type ComposerModel = {
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

type TraceStep = {
  label: string;
  detail?: string;
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isTerminalJob(job: DocumentIngestJobResponse) {
  return TERMINAL_JOB_STATUSES.has(job.status);
}

function statusTone(status?: MessageStatus | string) {
  if (status === "error" || status === "ERROR") return "danger";
  if (status === "streaming" || status === "sending") return "warning";
  return "success";
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Request failed";
}

function friendlyError(message: string) {
  if (message.includes("DASHSCOPE_API_KEY") || message.includes("AI 模型未配置")) {
    return "AI model is not configured yet. Set a model key in the backend, then retry this message.";
  }
  return message;
}

function modeIcon(mode: ChatMode) {
  if (mode.tone === "agent") return Bot;
  if (mode.tone === "knowledge") return Database;
  return MessageSquare;
}

function isGptSeriesModel(model?: string) {
  return model?.trim().toLowerCase().startsWith("gpt") ?? false;
}

function normalizeReasoningEffort(value?: string | null): ReasoningEffort {
  const normalized = value?.trim().toLowerCase().replace("_", "-");
  if (normalized === "x-high" || normalized === "extra-high") return "xhigh";
  return REASONING_EFFORTS.some((effort) => effort.value === normalized) ? (normalized as ReasoningEffort) : "high";
}

function reasoningEffortLabel(value?: string | null) {
  const normalized = normalizeReasoningEffort(value);
  return REASONING_EFFORTS.find((effort) => effort.value === normalized)?.label ?? "High";
}

function compactReasoningEffortLabel(value?: string | null) {
  const normalized = normalizeReasoningEffort(value);
  if (normalized === "xhigh") return "xHigh";
  return normalized;
}

function modelPickerReasoningLabel(value?: string | null) {
  const normalized = normalizeReasoningEffort(value);
  if (normalized === "low") return "低";
  if (normalized === "medium") return "中";
  if (normalized === "high") return "高";
  if (normalized === "xhigh") return "超高";
  return reasoningEffortLabel(normalized);
}

function modelPickerModelLabel(model: ComposerModel) {
  return model.id
    .replace(/^gpt/i, "GPT")
    .replace(/(^|-)mini/gi, "$1Mini")
    .replace(/(^|-)codex/gi, "$1Codex")
    .replace(/(^|-)opus/gi, "$1Opus")
    .replace(/(^|-)sonnet/gi, "$1Sonnet")
    .replace(/(^|-)gemini/gi, "$1Gemini");
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / 1024 / 102.4) / 10} MB`;
}

function parseMetadataJson(value?: string) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch {
    return {details: value};
  }
  return {details: value};
}

function getObjectValue(value: unknown, key: string) {
  return typeof value === "object" && value !== null && key in value ? (value as Record<string, unknown>)[key] : undefined;
}

function stringifyDetail(value: unknown) {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  return JSON.stringify(value, null, 2);
}

function extractTraceSteps(meta?: Record<string, unknown>): TraceStep[] {
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

function supportsOpenAiProtocol(modelStatus: ModelStatusResponse | null) {
  return (modelStatus?.provider ?? "").toLowerCase().includes("openai") || isGptSeriesModel(modelStatus?.model);
}

function inferProviderLabel(modelStatus: ModelStatusResponse | null) {
  const provider = modelStatus?.provider?.trim();
  const model = modelStatus?.model?.trim().toLowerCase() ?? "";
  if (provider) return provider;
  if (model.startsWith("gpt")) return "OpenAI";
  if (model.includes("qwen")) return "DashScope";
  if (model.includes("claude")) return "Anthropic";
  if (model.includes("gemini")) return "Google";
  return "Backend";
}

function modeLabel(modeId?: string) {
  return CHAT_MODES.find((mode) => mode.id === modeId)?.label ?? "Chat";
}

function routeLabel(route?: AutoRouteId | string) {
  if (!route) return "Auto";
  return CHAT_MODES.find((mode) => mode.id === route)?.label ?? route;
}

function routeModeId(route?: AutoRouteId | string): ChatModeId {
  if (route === "direct" || route === "chat" || route === "stream") return "direct";
  if (route === "agent") return "agent";
  if (route === "adaptive-rag") return "adaptive-rag";
  if (route === "rag") return "rag";
  if (route === "draft") return "draft";
  return "auto";
}

function modelDisplayName(modelId: string) {
  return modelId
    .split(/[-_:]/)
    .filter(Boolean)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join(" ");
}

function composerModelFromOption(option: ModelOption, modelStatus: ModelStatusResponse | null, reasoning: ReasoningEffort): ComposerModel {
  const id = option.id.trim();
  const provider = option.ownedBy === "configured" ? inferProviderLabel(modelStatus) : option.ownedBy || inferProviderLabel(modelStatus);
  const meta = compactReasoningEffortLabel(reasoning);
  return {
    id,
    name: id,
    title: modelDisplayName(id),
    meta,
    provider,
    contextWindow: modelStatus?.maxOutputTokens ? `${modelStatus.maxOutputTokens.toLocaleString()} max output tokens` : "Runtime configured context",
    description: `${provider} model available through the current backend configuration.`,
    note: option.ownedBy === "configured" ? "Currently configured model." : "Loaded from the upstream model list.",
    version: `${reasoningEffortLabel(reasoning)} reasoning effort`,
  };
}

function modelOptionsWithCurrent(options: ModelOption[], currentModel?: string) {
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

function formatTime(value?: string) {
  if (!value) return "No turns yet";
  return new Intl.DateTimeFormat(undefined, {month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"}).format(
    new Date(value),
  );
}

function messageFromTurn(turn: ChatTurnSummary): WorkspaceMessage[] {
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

export function App() {
  const [apiBase, setApiBase] = useState(getDefaultApiBase());
  const [userId, setUserId] = useState(1);
  const [sessionId, setSessionId] = useState(() => Date.now());
  const [lastRouteResult, setLastRouteResult] = useState<AutoChatResponse | null>(null);
  const [view, setView] = useState<"chat" | "settings">("chat");
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [chatStatus, setChatStatus] = useState<"ready" | "submitted" | "streaming" | "error">("ready");
  const [health, setHealth] = useState<"checking" | "up" | "down">("checking");
  const [healthMessage, setHealthMessage] = useState("Checking backend health");
  const [modelStatus, setModelStatus] = useState<ModelStatusResponse | null>(null);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSessionSummary | null>(null);
  const [turns, setTurns] = useState<ChatTurnSummary[]>([]);
  const [sessionQuery, setSessionQuery] = useState("");
  const [jobs, setJobs] = useState<DocumentIngestJobResponse[]>([]);
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const api = useMemo(() => createApiClient(apiBase), [apiBase]);
  const activeMode = CHAT_MODES[0];
  const filteredSessions = useMemo(() => {
    const query = sessionQuery.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) =>
      [session.title, session.summary, modeLabel(session.mode)].some((value) => (value ?? "").toLowerCase().includes(query)),
    );
  }, [sessionQuery, sessions]);

  const updateMessage = useCallback((id: string, patch: Partial<WorkspaceMessage>) => {
    setMessages((current) => current.map((message) => (message.id === id ? {...message, ...patch} : message)));
  }, []);

  const appendAssistantContent = useCallback((id: string, text: string) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? {...message, content: `${message.content}${text}`} : message)),
    );
  }, []);

  const refreshSessions = useCallback(async () => {
    const items = await api.listSessions(userId, 60);
    setSessions(items);
    setSelectedSession((current) => items.find((item) => item.sessionId === (current?.sessionId ?? sessionId)) ?? current);
  }, [api, sessionId, userId]);

  const loadSession = useCallback(
    async (targetSessionId: number) => {
      const detail = await api.getSession(userId, targetSessionId);
      setSelectedSession(detail.session);
      setSessionId(detail.session.sessionId);
      setTurns(detail.turns);
      setMessages(detail.turns.flatMap(messageFromTurn));
      const lastTurn = [...detail.turns].reverse().find((turn) => turn.requestId);
      setLastRouteResult(
        lastTurn
          ? {
              route: routeModeId(lastTurn.mode),
              forced: lastTurn.metadataJson?.includes("\"forced\":true") ?? false,
              reason: lastTurn.metadataJson ? "Loaded from session history." : undefined,
              requestId: lastTurn.requestId,
              status: lastTurn.status,
            }
          : null,
      );
    },
    [api, userId],
  );

  const checkHealth = useCallback(async () => {
    setHealth("checking");
    setHealthMessage("Checking backend health");
    try {
      const [healthResult, model] = await Promise.all([api.health(), api.modelStatus()]);
      const status = healthResult.status ?? "UNKNOWN";
      setHealth(status === "UP" ? "up" : "down");
      setHealthMessage(`Backend health: ${status}`);
      setModelStatus(model);
    } catch (error) {
      setHealth("down");
      setHealthMessage(getErrorMessage(error));
    }
  }, [api]);

  useEffect(() => {
    void checkHealth();
    void refreshSessions();
  }, [checkHealth, refreshSessions]);

  useEffect(() => {
    const runningJobs = jobs.filter((job) => !isTerminalJob(job));
    if (!runningJobs.length) return;
    const timer = window.setInterval(() => {
      runningJobs.forEach((job) => {
        void api.getIngestJob(job.jobId).then((freshJob) => {
          setJobs((current) => current.map((item) => (item.jobId === freshJob.jobId ? freshJob : item)));
        });
      });
    }, 1800);
    return () => window.clearInterval(timer);
  }, [api, jobs]);

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
    setMessages([]);
    setPrompt("");
    setLastRouteResult(null);
    await refreshSessions();
  }

  async function syncCurrentSession() {
    await refreshSessions();
    await loadSession(sessionId);
  }

  async function sendPrompt() {
    const trimmed = prompt.trim();
    if (!trimmed || chatStatus === "submitted" || chatStatus === "streaming") return;

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
      window.setTimeout(() => void syncCurrentSession(), 500);
    }
  }

  function stopStream() {
    abortRef.current?.abort();
    abortRef.current = null;
    setChatStatus("ready");
  }

  async function refreshMemories() {
    setMemoryItems(await api.listUserMemories(userId, 20));
  }

  function addJob(job: DocumentIngestJobResponse) {
    setJobs((current) => [job, ...current.filter((item) => item.jobId !== job.jobId)]);
  }

  return (
    <Sidebar.Provider collapsible="offcanvas" reduceMotion toggleShortcut={false}>
      <div className="flex h-svh w-full min-w-0 overflow-hidden bg-background text-foreground">
        <GlobalSidebar health={health} view={view} onNavigate={setView} />
        <Sidebar.Main className="min-w-0 flex-1">
          <AnimatePresence initial={false} mode="wait">
            <AnimatedWorkspaceView key={view} direction={view === "settings" ? 1 : -1}>
              {view === "settings" ? (
                <SettingsWorkspace
                  api={api}
                  apiBase={apiBase}
                  health={health}
                  healthMessage={healthMessage}
                  jobs={jobs}
                  memoryItems={memoryItems}
                  modelStatus={modelStatus}
                  sessionId={sessionId}
                  userId={userId}
                  onBack={() => setView("chat")}
                  onCheckHealth={checkHealth}
                  onJob={addJob}
                  onMemoryItems={setMemoryItems}
                  onModelStatus={setModelStatus}
                  onNavigate={setView}
                  onRefreshMemories={() => void refreshMemories()}
                />
              ) : (
                <div className="grid h-svh min-w-0 grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
                  <SessionList
                    activeSessionId={sessionId}
                    query={sessionQuery}
                    sessions={filteredSessions}
                    totalSessions={sessions.length}
                    onNewSession={() => void startNewSession()}
                    onQueryChange={setSessionQuery}
                    onRefresh={() => void refreshSessions()}
                    onSelect={(target) => void loadSession(target)}
                  />
                  <main className="grid min-h-0 min-w-0 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_340px]">
                    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                      <ChatHeader
                        activeSessionId={sessionId}
                        activeMode={activeMode}
                        health={health}
                        modelStatus={modelStatus}
                        query={sessionQuery}
                        session={selectedSession}
                        sessions={filteredSessions}
                        totalSessions={sessions.length}
                        onCheckHealth={checkHealth}
                        onNavigate={setView}
                        onNewSession={() => void startNewSession()}
                        onOpenSettings={() => setView("settings")}
                        onQueryChange={setSessionQuery}
                        onRefreshSessions={() => void refreshSessions()}
                        onSelectSession={(target) => void loadSession(target)}
                      />
                      <MessageTimeline messages={messages} />
                      <ComposerDock
                        api={api}
                        lastRouteResult={lastRouteResult}
                        modelStatus={modelStatus}
                        prompt={prompt}
                        status={chatStatus}
                        onJob={addJob}
                        onModelStatus={setModelStatus}
                        onPromptChange={setPrompt}
                        onSend={() => void sendPrompt()}
                        onStop={stopStream}
                      />
                    </section>
                    <SessionInsightPanel
                      modelStatus={modelStatus}
                      session={selectedSession}
                      turns={turns}
                      onSummarize={() => void api.summarizeSession(userId, sessionId).then((session) => setSelectedSession(session))}
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

function AnimatedWorkspaceView({children, direction}: {children: ReactNode; direction: 1 | -1}) {
  return (
    <motion.div
      className="h-svh min-w-0 overflow-hidden"
      initial={{opacity: 0, x: direction * 18, scale: 0.995}}
      animate={{opacity: 1, x: 0, scale: 1}}
      exit={{opacity: 0, x: direction * -14, scale: 0.998}}
      transition={{duration: 0.18, ease: [0.22, 1, 0.36, 1]}}
    >
      {children}
    </motion.div>
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    const updateMatches = () => setMatches(media.matches);

    updateMatches();
    media.addEventListener("change", updateMatches);
    return () => media.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}

const THEME_STORAGE_KEY = "infinitechat-theme";

type ColorScheme = "light" | "dark";

// Module-level theme store so any component can read/toggle the color scheme
// without prop drilling, and every consumer (desktop sidebar, mobile sheet)
// stays in sync. Dark mode is activated by toggling `.dark` on <html>, which
// is how HeroUI v3 scopes its dark tokens.
const themeStore = (() => {
  const listeners = new Set<() => void>();

  function readStored(): ColorScheme | null {
    if (typeof window === "undefined") return null;
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  }

  function systemScheme(): ColorScheme {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function apply(scheme: ColorScheme) {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", scheme === "dark");
    }
  }

  let current: ColorScheme = readStored() ?? systemScheme();
  apply(current);

  if (typeof window !== "undefined") {
    // Follow the OS preference until the user makes an explicit choice.
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
      if (readStored()) return;
      current = event.matches ? "dark" : "light";
      apply(current);
      listeners.forEach((listener) => listener());
    });
  }

  return {
    get: () => current,
    set(scheme: ColorScheme) {
      current = scheme;
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, scheme);
      } catch {
        // ignore storage failures (private mode, quota, etc.)
      }
      apply(scheme);
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
})();

function useColorScheme() {
  const scheme = useSyncExternalStore(themeStore.subscribe, themeStore.get, () => "light" as ColorScheme);
  const toggle = useCallback(() => themeStore.set(scheme === "dark" ? "light" : "dark"), [scheme]);
  return {scheme, isDark: scheme === "dark", toggle};
}

function SidebarThemeToggle() {
  const {isDark, toggle} = useColorScheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="flex min-h-9 w-full items-center gap-3 rounded-2xl px-2 text-sm text-foreground transition-colors hover:bg-default"
    >
      <span className="grid size-5 shrink-0 place-items-center text-muted">
        {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-left" data-sidebar="label">
        {isDark ? "Dark" : "Light"}
      </span>
    </button>
  );
}

function DesktopSidebarTrigger() {
  return (
    <Sidebar.Trigger aria-label="Toggle workspace navigation" className="sidebar-trigger sidebar-trigger--desktop">
      <PanelLeft className="size-4" />
    </Sidebar.Trigger>
  );
}

function GlobalSidebar({
  health,
  view,
  onNavigate,
}: {
  health: "checking" | "up" | "down";
  view: "chat" | "settings";
  onNavigate: (view: "chat" | "settings") => void;
}) {
  const healthClass = health === "up" ? "bg-success" : health === "checking" ? "bg-warning" : "bg-danger";

  return (
    <>
      <Sidebar className="hidden lg:flex">
        <GlobalSidebarContents healthClass={healthClass} health={health} view={view} onNavigate={onNavigate} />
      </Sidebar>
    </>
  );
}

function MobileWorkspaceSheet({
  health,
  view,
  onNavigate,
}: {
  health: "checking" | "up" | "down";
  view: "chat" | "settings";
  onNavigate: (view: "chat" | "settings") => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobileNav = useMediaQuery(MOBILE_NAV_QUERY);
  const healthClass = health === "up" ? "bg-success" : health === "checking" ? "bg-warning" : "bg-danger";
  const handleNavigate = useCallback(
    (nextView: "chat" | "settings") => {
      onNavigate(nextView);
      setIsOpen(false);
    },
    [onNavigate],
  );

  useEffect(() => {
    if (!isMobileNav && isOpen) setIsOpen(false);
  }, [isMobileNav, isOpen]);

  return (
    <Sheet isDetached isOpen={isMobileNav && isOpen} placement="left" snapPoints={["min(88vw,320px)"]} onOpenChange={setIsOpen}>
      <Sheet.Trigger>
        <Button isIconOnly aria-label="Open navigation" className="sidebar-trigger sidebar-trigger--mobile" size="sm" variant="outline">
          <PanelLeft className="size-4" />
        </Button>
      </Sheet.Trigger>
      <Sheet.Backdrop variant="blur">
        <Sheet.Content className="sidebar__mobile-sheet max-w-[min(88vw,320px)]">
          <Sheet.Dialog className="sidebar__mobile-dialog">
            <Sheet.Header className="sr-only">
              <Sheet.Heading>Workspace navigation</Sheet.Heading>
            </Sheet.Header>
            <div className="sidebar__mobile" data-slot="sidebar-mobile">
              <GlobalSidebarContents
                healthClass={healthClass}
                health={health}
                idPrefix="mobile-"
                view={view}
                onNavigate={handleNavigate}
              />
            </div>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}

function GlobalSidebarContents({
  healthClass,
  health,
  idPrefix = "",
  view,
  onNavigate,
}: {
  healthClass: string;
  health: "checking" | "up" | "down";
  idPrefix?: string;
  view: "chat" | "settings";
  onNavigate: (view: "chat" | "settings") => void;
}) {
  return (
    <>
      <Sidebar.Header>
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="grid size-9 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0" data-sidebar="label">
            <div className="truncate text-sm font-semibold">InfiniteChat</div>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span className={`size-1.5 rounded-full ${healthClass}`} />
              <span>{health === "up" ? "Backend ready" : health === "checking" ? "Checking" : "Offline"}</span>
            </div>
          </div>
        </div>
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Workspace</Sidebar.GroupLabel>
          <Sidebar.Menu aria-label="Workspace navigation">
            <Sidebar.MenuItem id={`${idPrefix}chat`} isCurrent={view === "chat"} textValue="Chat" onAction={() => onNavigate("chat")}>
              <Sidebar.MenuIcon>
                <MessageSquare className="size-4" />
              </Sidebar.MenuIcon>
              <Sidebar.MenuLabel>Chat</Sidebar.MenuLabel>
            </Sidebar.MenuItem>
            <Sidebar.MenuItem id={`${idPrefix}settings`} isCurrent={view === "settings"} textValue="Settings" onAction={() => onNavigate("settings")}>
              <Sidebar.MenuIcon>
                <Settings className="size-4" />
              </Sidebar.MenuIcon>
              <Sidebar.MenuLabel>Settings</Sidebar.MenuLabel>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Group>
      </Sidebar.Content>
      <Sidebar.Footer>
        <SidebarThemeToggle />
      </Sidebar.Footer>
    </>
  );
}

function SessionList({
  activeSessionId,
  query,
  sessions,
  totalSessions,
  onNewSession,
  onQueryChange,
  onRefresh,
  onSelect,
}: {
  activeSessionId: number;
  query: string;
  sessions: ChatSessionSummary[];
  totalSessions: number;
  onNewSession: () => void;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onSelect: (sessionId: number) => void;
}) {
  return (
    <aside className="hidden min-h-0 min-w-0 border-r border-separator bg-surface-secondary/60 lg:flex lg:flex-col">
      <SessionListContent
        activeSessionId={activeSessionId}
        query={query}
        sessions={sessions}
        totalSessions={totalSessions}
        onNewSession={onNewSession}
        onQueryChange={onQueryChange}
        onRefresh={onRefresh}
        onSelect={onSelect}
      />
    </aside>
  );
}

function SessionListContent({
  activeSessionId,
  query,
  sessions,
  totalSessions,
  onNewSession,
  onQueryChange,
  onRefresh,
  onSelect,
}: {
  activeSessionId: number;
  query: string;
  sessions: ChatSessionSummary[];
  totalSessions: number;
  onNewSession: () => void;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onSelect: (sessionId: number) => void;
}) {
  return (
    <>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">Conversations</h1>
            <p className="truncate text-sm text-muted">{totalSessions ? `${totalSessions} real sessions` : "No saved sessions yet"}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button isIconOnly aria-label="Refresh sessions" className="icon-button" size="sm" variant="outline" onPress={onRefresh}>
              <RefreshCw className="size-4" />
            </Button>
            <Button isIconOnly aria-label="New session" className="icon-button" size="sm" variant="outline" onPress={onNewSession}>
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        <label className="session-search">
          <Search className="size-4 shrink-0" />
          <input
            disabled={!totalSessions}
            placeholder={totalSessions ? "Search sessions" : "Search available after a session exists"}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
      </div>

      <ScrollShadow className="min-h-0 flex-1 overflow-y-auto px-3 pb-4" hideScrollBar>
        {sessions.length === 0 ? (
          <div className="rounded-lg bg-surface p-4 text-sm leading-6 text-muted shadow-surface">
            Send a message or create a session to populate real conversation history.
          </div>
        ) : (
          <ChatListView
            aria-label="Conversation sessions"
            className="session-list-view"
            density="compact"
            items={sessions}
            selectionBehavior="replace"
            selectionMode="single"
            selectedKeys={new Set([String(activeSessionId)])}
            onSelectionChange={(keys) => {
              if (keys === "all") return;

              const [key] = Array.from(keys);
              const sessionId = Number(key);

              if (Number.isFinite(sessionId)) onSelect(sessionId);
            }}
          >
            {(session) => (
              <ChatListView.Item
                key={String(session.sessionId)}
                id={String(session.sessionId)}
                textValue={session.title || "Conversation"}
              >
                <ChatListView.Icon>
                  <MessageSquare className="size-4" />
                </ChatListView.Icon>
                <ChatListView.ItemContent>
                  <ChatListView.Text>
                    <ChatListView.Title>{session.title || "Conversation"}</ChatListView.Title>
                    <ChatListView.Preview>
                      {session.summary || formatTime(session.lastMessageAt || session.updatedAt)}
                    </ChatListView.Preview>
                  </ChatListView.Text>
                  <ChatListView.Meta>
                    <Chip color={statusTone(session.lastStatus)} size="sm" variant="soft">
                      {session.turnCount ?? 0}
                    </Chip>
                  </ChatListView.Meta>
                </ChatListView.ItemContent>
              </ChatListView.Item>
            )}
          </ChatListView>
        )}
      </ScrollShadow>
    </>
  );
}

function ChatHeader({
  activeSessionId,
  activeMode,
  health,
  modelStatus,
  query,
  session,
  sessions,
  totalSessions,
  onCheckHealth,
  onNavigate,
  onNewSession,
  onOpenSettings,
  onQueryChange,
  onRefreshSessions,
  onSelectSession,
}: {
  activeSessionId: number;
  activeMode: ChatMode;
  health: "checking" | "up" | "down";
  modelStatus: ModelStatusResponse | null;
  query: string;
  session: ChatSessionSummary | null;
  sessions: ChatSessionSummary[];
  totalSessions: number;
  onCheckHealth: () => void;
  onNavigate: (view: "chat" | "settings") => void;
  onNewSession: () => void;
  onOpenSettings: () => void;
  onQueryChange: (value: string) => void;
  onRefreshSessions: () => void;
  onSelectSession: (sessionId: number) => void;
}) {
  return (
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-separator bg-background px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <DesktopSidebarTrigger />
          <MobileWorkspaceSheet health={health} view="chat" onNavigate={onNavigate} />
          <MobileSessionSheet
          activeSessionId={activeSessionId}
          query={query}
          sessions={sessions}
          totalSessions={totalSessions}
          onNewSession={onNewSession}
          onQueryChange={onQueryChange}
          onRefresh={onRefreshSessions}
          onSelect={onSelectSession}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold md:text-base">{session?.title || activeMode.label}</h2>
            <Chip size="sm" variant="soft" color={statusTone(health === "up" ? "complete" : "error")}>
              {health === "up" ? "UP" : health === "checking" ? "CHECKING" : "DOWN"}
            </Chip>
            <Chip size="sm" variant="soft" color={modelStatus?.configured ? "success" : "warning"}>
              {modelStatus?.configured ? "Model ready" : "Model missing"}
            </Chip>
          </div>
          <p className="truncate text-xs text-muted">Auto routing chooses the backend capability for each turn.</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button className="control-button header-action-button" size="sm" variant="outline" onPress={onCheckHealth}>
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        <Button isIconOnly aria-label="Open settings" className="icon-button" size="sm" variant="outline" onPress={onOpenSettings}>
          <Settings className="size-4" />
        </Button>
      </div>
    </header>
  );
}

function MobileSessionSheet({
  activeSessionId,
  query,
  sessions,
  totalSessions,
  onNewSession,
  onQueryChange,
  onRefresh,
  onSelect,
}: {
  activeSessionId: number;
  query: string;
  sessions: ChatSessionSummary[];
  totalSessions: number;
  onNewSession: () => void;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onSelect: (sessionId: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobileNav = useMediaQuery(MOBILE_NAV_QUERY);
  const handleNewSession = useCallback(() => {
    onNewSession();
    setIsOpen(false);
  }, [onNewSession]);
  const handleSelect = useCallback(
    (sessionId: number) => {
      onSelect(sessionId);
      setIsOpen(false);
    },
    [onSelect],
  );

  useEffect(() => {
    if (!isMobileNav && isOpen) setIsOpen(false);
  }, [isMobileNav, isOpen]);

  return (
    <Sheet isDetached isOpen={isMobileNav && isOpen} placement="left" snapPoints={["min(88vw,320px)"]} onOpenChange={setIsOpen}>
      <Sheet.Trigger>
        <Button isIconOnly aria-label="Open conversation history" className="sidebar-trigger sidebar-trigger--mobile" size="sm" variant="outline">
          <MessageSquare className="size-4" />
        </Button>
      </Sheet.Trigger>
      <Sheet.Backdrop>
        <Sheet.Content className="max-w-[min(88vw,320px)]">
          <Sheet.Dialog className="flex h-full min-h-0 flex-col overflow-hidden p-0">
            <Sheet.Header className="sr-only">
              <Sheet.Heading>Conversation history</Sheet.Heading>
            </Sheet.Header>
            <SessionListContent
              activeSessionId={activeSessionId}
              query={query}
              sessions={sessions}
              totalSessions={totalSessions}
              onNewSession={handleNewSession}
              onQueryChange={onQueryChange}
              onRefresh={onRefresh}
              onSelect={handleSelect}
            />
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}

function MessageTimeline({messages}: {messages: WorkspaceMessage[]}) {
  return (
    <ChatConversation className="min-h-0 flex-1 overflow-y-auto" resize="smooth">
      <ChatConversation.Content className="mx-auto flex w-full max-w-[820px] flex-col gap-6 px-4 py-6 md:px-6">
        {messages.length === 0 ? (
          <div className="chat-empty-state mx-auto flex min-h-[42vh] w-full max-w-xl flex-col items-center justify-center text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-surface-secondary text-muted">
              <MessageSquare className="size-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold">Start a real conversation</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted">
              Use the composer below. Conversations and turn summaries are saved after backend responses.
            </p>
          </div>
        ) : (
          messages.map((message) => <MessageTurn key={message.id} message={message} />)
        )}
        <ChatConversation.ScrollAnchor />
      </ChatConversation.Content>
      <ChatConversation.ScrollButton tooltip="Jump to latest" />
    </ChatConversation>
  );
}

function MessageTurn({message}: {message: WorkspaceMessage}) {
  if (message.role === "user") {
    return (
      <ChatMessage.User>
        <ChatMessage.Bubble>
          <ChatMessage.Content>{message.content}</ChatMessage.Content>
        </ChatMessage.Bubble>
      </ChatMessage.User>
    );
  }

  if (message.role === "system") {
    return <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{message.content}</div>;
  }

  return (
    <ChatMessage.Assistant>
      <ChatMessage.Avatar show alt="InfiniteChat" fallback="AI" />
      <ChatMessage.Body>
        <div className="flex items-center gap-2">
          <Chip size="sm" variant="soft" color={statusTone(message.status)}>
            {message.status ?? "complete"}
          </Chip>
        </div>
        <ChatMessage.Content>
          {message.content ? (
            <Markdown>{message.content}</Markdown>
          ) : message.status === "streaming" ? (
            <TextShimmer>Thinking...</TextShimmer>
          ) : (
            <ChatLoader.Dots label="Waiting for response" />
          )}
        </ChatMessage.Content>
        {message.citations?.length ? <CitationList citations={message.citations} /> : null}
        {message.meta || message.requestId ? <ResponseDetails meta={message.meta} requestId={message.requestId} /> : null}
        {message.content ? (
          <ChatMessageActions>
            <ChatMessageActions.Copy aria-label="Copy assistant response" />
            <ChatMessageActions.ThumbsUp aria-label="Mark helpful" />
            <ChatMessageActions.ThumbsDown aria-label="Mark unhelpful" />
          </ChatMessageActions>
        ) : null}
      </ChatMessage.Body>
    </ChatMessage.Assistant>
  );
}

function CitationList({citations}: {citations: Citation[]}) {
  return (
    <ChatSources defaultExpanded={false}>
      <ChatSources.Trigger>{citations.length} sources</ChatSources.Trigger>
      <ChatSources.Content>
        <ChatSources.List>
          {citations.map((citation, index) => (
            <ChatSource
              key={`${citation.chunkId ?? citation.docId ?? index}`}
              description={citation.snippet}
              sourceType="document"
              title={citation.fileName ?? citation.docId ?? `Source ${index + 1}`}
            />
          ))}
        </ChatSources.List>
      </ChatSources.Content>
    </ChatSources>
  );
}

function ResponseDetails({meta, requestId}: {meta?: Record<string, unknown>; requestId?: string}) {
  const steps = extractTraceSteps(meta);
  const toolTrace = getObjectValue(meta, "toolTrace") ?? getObjectValue(getObjectValue(meta, "details"), "toolTrace");
  const detailCode = JSON.stringify({requestId, ...meta}, null, 2);

  return (
    <div className="response-details">
      {steps.length ? (
        <ChainOfThought defaultExpanded={false}>
          <ChainOfThought.Trigger>Routing trace</ChainOfThought.Trigger>
          <ChainOfThought.Content>
            <ChainOfThought.Steps>
              {steps.map((step) => (
                <ChainOfThought.Step key={`${step.label}-${step.detail ?? ""}`} label={step.label}>
                  {step.detail ? <span>{step.detail}</span> : null}
                </ChainOfThought.Step>
              ))}
            </ChainOfThought.Steps>
          </ChainOfThought.Content>
        </ChainOfThought>
      ) : null}
      {toolTrace ? (
        <ChatToolGroup>
          <ChatTool
            input={toolTrace}
            isExpandable
            output={getObjectValue(toolTrace, "trace") ?? toolTrace}
            state="output-available"
            toolName={String(getObjectValue(toolTrace, "capability") ?? "backend-route")}
          />
        </ChatToolGroup>
      ) : null}
      <details className="response-details-code">
        <summary>Details</summary>
        <CodeBlock className="mt-2">
          <CodeBlock.Header>
            <span>Raw response</span>
            <CodeBlock.CopyButton aria-label="Copy response details" code={detailCode} />
          </CodeBlock.Header>
          <CodeBlock.Code code={detailCode} language="json" />
        </CodeBlock>
      </details>
    </div>
  );
}

function ComposerDock({
  api,
  lastRouteResult,
  modelStatus,
  prompt,
  status,
  onJob,
  onModelStatus,
  onPromptChange,
  onSend,
  onStop,
}: {
  api: ReturnType<typeof createApiClient>;
  lastRouteResult: AutoChatResponse | null;
  modelStatus: ModelStatusResponse | null;
  prompt: string;
  status: "ready" | "submitted" | "streaming" | "error";
  onJob: (job: DocumentIngestJobResponse) => void;
  onModelStatus: (status: ModelStatusResponse) => void;
  onPromptChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
}) {
  const currentModel = modelStatus?.model?.trim() ?? "";
  const reasoningEffort = normalizeReasoningEffort(modelStatus?.reasoningEffort);
  const openAiProtocol = supportsOpenAiProtocol(modelStatus);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modelsStatus, setModelsStatus] = useState<string | null>(null);
  const [tuningStatus, setTuningStatus] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const availableOptions = useMemo(() => modelOptionsWithCurrent(modelOptions, currentModel), [currentModel, modelOptions]);
  const availableModels = useMemo(
    () => availableOptions.map((option) => composerModelFromOption(option, modelStatus, reasoningEffort)),
    [availableOptions, modelStatus, reasoningEffort],
  );
  const selectedModel = availableModels.find((model) => model.id === currentModel) ?? availableModels[0];
  const hasValue = prompt.trim().length > 0;
  const isRunning = status === "submitted" || status === "streaming";
  const route = lastRouteResult ? routeLabel(lastRouteResult.route) : "Auto";
  const routeMeta = lastRouteResult ? `${route}${lastRouteResult.forced ? " · forced" : ""}` : "Direct when simple";
  const progressValue = status === "streaming" ? 64 : status === "submitted" ? 32 : status === "error" ? 100 : 0;
  const statusText = status === "streaming" ? "Streaming" : status === "submitted" ? "Submitted" : status === "error" ? "Error" : "Ready";

  const refreshModels = useCallback(async () => {
    if (!openAiProtocol) {
      setModelOptions([]);
      setModelsStatus("Model listing is available for OpenAI-compatible providers.");
      return;
    }
    setIsLoadingModels(true);
    try {
      const response = await api.listModels();
      setModelOptions(response.models ?? []);
      setModelsStatus(response.message ?? (response.source === "upstream" ? "Loaded models from upstream." : "Using configured model."));
    } catch (error) {
      setModelsStatus(getErrorMessage(error));
    } finally {
      setIsLoadingModels(false);
    }
  }, [api, openAiProtocol]);

  useEffect(() => {
    if (modelStatus?.configured && openAiProtocol) {
      void refreshModels();
      return;
    }
    setModelOptions([]);
  }, [modelStatus?.baseUrl, modelStatus?.configured, modelStatus?.provider, openAiProtocol, refreshModels]);

  useEffect(
    () => () => {
      attachments.forEach((attachment) => {
        if (attachment.src?.startsWith("blob:")) URL.revokeObjectURL(attachment.src);
      });
    },
    [attachments],
  );

  const saveTuning = useCallback(
    async ({model, reasoning}: {model?: string; reasoning?: ReasoningEffort}) => {
      const nextModel = model?.trim() || currentModel;
      const nextReasoning = normalizeReasoningEffort(reasoning ?? reasoningEffort);
      setIsSaving(true);
      setTuningStatus("Saving model");
      try {
        const nextStatus = await api.updateModelConfig({
          provider: modelStatus?.provider ?? "openai-compatible",
          baseUrl: modelStatus?.baseUrl,
          model: nextModel,
          temperature: modelStatus?.temperature,
          maxOutputTokens: modelStatus?.maxOutputTokens,
          reasoningEffort: openAiProtocol ? nextReasoning : undefined,
        });
        onModelStatus(nextStatus);
        setTuningStatus(nextStatus.configured ? "Model saved." : nextStatus.message ?? "Model saved.");
      } catch (error) {
        setTuningStatus(getErrorMessage(error));
      } finally {
        setIsSaving(false);
      }
    },
    [api, currentModel, modelStatus, onModelStatus, openAiProtocol, reasoningEffort],
  );

  const addCommand = useCallback(
    (command: string) => {
      const nextValue = prompt.trim() ? `${command} ${prompt.replace(/^\/\S+\s*/, "")}` : `${command} `;
      onPromptChange(nextValue);
    },
    [onPromptChange, prompt],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === id);
      if (target?.src?.startsWith("blob:")) URL.revokeObjectURL(target.src);
      return current.filter((attachment) => attachment.id !== id);
    });
  }, []);

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        const id = makeId("attachment");
        const src = file.type.startsWith("image/") || file.type.startsWith("video/") ? URL.createObjectURL(file) : undefined;
        setAttachments((current) => [
          ...current,
          {id, name: file.name, size: file.size, mimeType: file.type, src, status: "uploading", message: "Uploading"},
        ]);
        void api
          .uploadDocument(file)
          .then((job) => {
            onJob(job);
            setAttachments((current) =>
              current.map((attachment) =>
                attachment.id === id
                  ? {...attachment, status: "ready", message: job.message ?? "Queued for knowledge import", jobId: job.jobId}
                  : attachment,
              ),
            );
          })
          .catch((error) => {
            setAttachments((current) =>
              current.map((attachment) =>
                attachment.id === id ? {...attachment, status: "error", message: getErrorMessage(error)} : attachment,
              ),
            );
          });
      });
    },
    [api, onJob],
  );

  return (
    <div className="composer-dock shrink-0 bg-background px-4 py-3 md:px-6">
      <div className="review-composer mx-auto flex w-full max-w-[820px] flex-col gap-3">
        <div className="composer-workflow-row">
          <Button className="composer-workflow-button" size="sm" style={COMPOSER_BUTTON_STYLE} variant="outline">
            <Route className="size-4" />
            <span>Auto</span>
            <span className="composer-workflow-meta">{routeMeta}</span>
          </Button>
          <Button
            className="composer-workflow-button hidden sm:inline-flex"
            isDisabled={!openAiProtocol}
            size="sm"
            style={COMPOSER_BUTTON_STYLE}
            variant="outline"
            onPress={() => void refreshModels()}
          >
            <RefreshCw className="size-4" />
            <span>{isLoadingModels ? "Loading" : "Models"}</span>
            <span className="composer-workflow-meta">{modelStatus?.configured ? "Upstream" : "Missing"}</span>
          </Button>
          <ComposerActionsPopover isRunning={isRunning} onCommand={addCommand} />
        </div>

        <ChatAttachmentInput accept=".md,.txt,.pdf,.doc,.docx,.json,.csv,image/*" multiple onFilesSelected={handleFilesSelected}>
          <ChatAttachmentInput.Dropzone>
            <PromptInput
              className="group min-w-0 max-w-full overflow-hidden"
              layout="compact"
              lockInputOnRun={false}
              status={status}
              value={prompt}
              onStop={onStop}
              onSubmit={onSend}
              onValueChange={onPromptChange}
            >
              <PromptInput.Shell>
                {attachments.length ? (
                  <PromptInput.Attachments>
                    <ChatAttachmentGroup className="flex flex-wrap gap-2">
                      {attachments.map((attachment) => (
                        <ChatAttachment
                          key={attachment.id}
                          mediaType={inferChatAttachmentMediaType(attachment.mimeType)}
                          mimeType={attachment.mimeType}
                          name={attachment.name}
                          src={attachment.src}
                          title={attachment.message}
                        >
                          <ChatAttachment.Name>
                            {attachment.name}
                            <span className="ml-1 text-muted">
                              {attachment.status === "uploading" ? "uploading" : formatFileSize(attachment.size)}
                            </span>
                          </ChatAttachment.Name>
                          <ChatAttachment.Remove aria-label={`Remove ${attachment.name}`} onPress={() => removeAttachment(attachment.id)}>
                            <X className="size-3" />
                          </ChatAttachment.Remove>
                        </ChatAttachment>
                      ))}
                    </ChatAttachmentGroup>
                  </PromptInput.Attachments>
                ) : null}
                <PromptInput.Content>
                  <PromptInput.TextArea className="composer-textarea min-w-0" placeholder="Message Auto" />
                </PromptInput.Content>
                <PromptInput.Toolbar className="group-data-[expanded=true]:justify-start group-data-[expanded=true]:gap-1.5 sm:group-data-[expanded=true]:justify-between">
                  <PromptInput.ToolbarStart>
                    <ChatAttachmentInput.Trigger
                      aria-label="Add context"
                      render={(triggerProps) => (
                        <PromptInput.Action
                          {...triggerProps}
                          aria-label="Add context"
                          className="bg-default text-muted hover:bg-default-hover"
                          tooltip="Add context"
                        >
                          <Plus className="size-4" />
                        </PromptInput.Action>
                      )}
                    />
                  </PromptInput.ToolbarStart>
                  <PromptInput.ToolbarEnd className="flex min-w-0 gap-1.5 group-data-[expanded=true]:!flex">
                    {selectedModel ? (
                      <ModelSelectControl
                        className="hidden w-auto min-w-0 sm:inline-flex"
                        disabled={!openAiProtocol || isSaving}
                        isLoadingModels={isLoadingModels}
                        model={selectedModel}
                        models={availableModels}
                        modelsStatus={modelsStatus}
                        popoverPlacement="top"
                        reasoningEffort={reasoningEffort}
                        selectedKey={selectedModel.id}
                        tuningStatus={tuningStatus}
                        onRefreshModels={() => void refreshModels()}
                        onReasoningChange={(reasoning) => void saveTuning({reasoning})}
                        onSelectionChange={(model) => void saveTuning({model})}
                      />
                    ) : null}
                    {selectedModel ? (
                      <MobileModelSheet
                        disabled={!openAiProtocol || isSaving}
                        isLoadingModels={isLoadingModels}
                        model={selectedModel}
                        models={availableModels}
                        modelsStatus={modelsStatus}
                        reasoningEffort={reasoningEffort}
                        selectedKey={selectedModel.id}
                        tuningStatus={tuningStatus}
                        onRefreshModels={() => void refreshModels()}
                        onReasoningChange={(reasoning) => void saveTuning({reasoning})}
                        onSelectionChange={(model) => void saveTuning({model})}
                      />
                    ) : null}
                    {hasValue ? (
                      <>
                        <PromptInput.Action
                          aria-label="Voice input"
                          className="bg-transparent text-muted hover:bg-default-hover"
                          tooltip="Voice input"
                        >
                          <Mic className="size-4" />
                        </PromptInput.Action>
                        <PromptInput.Send aria-label="Send message" className="composer-send-button" isDisabled={!hasValue}>
                          <ArrowUp className="size-4" />
                        </PromptInput.Send>
                      </>
                    ) : (
                      <PromptInput.Action
                        aria-label="Voice input"
                        className="composer-send-button"
                        tooltip="Voice input"
                      >
                        <Mic className="size-4" />
                      </PromptInput.Action>
                    )}
                  </PromptInput.ToolbarEnd>
                </PromptInput.Toolbar>
              </PromptInput.Shell>
            </PromptInput>
          </ChatAttachmentInput.Dropzone>
        </ChatAttachmentInput>

        <div className="composer-status-row">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <span className="flex min-w-0 items-center gap-1.5">
              <Route className="size-4 shrink-0" />
              <span className="truncate">{route}</span>
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <Monitor className="size-4 shrink-0" />
              <span className="truncate">{inferProviderLabel(modelStatus)}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ProgressCircle aria-label="Chat run progress" color={status === "error" ? "danger" : "default"} size="sm" value={progressValue}>
              <ProgressCircle.Track>
                <ProgressCircle.TrackCircle />
                <ProgressCircle.FillCircle />
              </ProgressCircle.Track>
            </ProgressCircle>
            <span className="tabular-nums">{statusText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComposerActionsPopover({isRunning, onCommand}: {isRunning: boolean; onCommand: (command: string) => void}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredCommands = SLASH_COMMANDS.filter((command) => command.toLowerCase().includes(normalizedSearch));

  return (
    <Popover>
      <Popover.Trigger>
        <Button
          isIconOnly
          aria-label="More composer actions"
          className="composer-icon-button"
          isDisabled={isRunning}
          size="sm"
          style={COMPOSER_BUTTON_STYLE}
          variant="outline"
        >
          <Ellipsis className="size-4" />
        </Button>
      </Popover.Trigger>
      <Popover.Content className="w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-2xl p-0" placement="top start">
        <Popover.Dialog className="p-0">
          <div className="p-2">
            <Input
              autoFocus
              fullWidth
              aria-label="Search routing commands"
              className="h-9 w-full border-0 bg-transparent px-2 text-sm shadow-none"
              placeholder="Search commands"
              value={search}
              variant="secondary"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Separator />
          {filteredCommands.length ? (
            <ListBox aria-label="Routing commands" className="scrollbar max-h-[min(320px,calc(100vh-10rem))] overflow-y-auto p-2">
              {filteredCommands.map((command) => (
                <ListBox.Item key={command} id={command} textValue={command} onAction={() => onCommand(command)}>
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <Code2 className="size-4 shrink-0 text-muted" />
                    <span className="truncate">{command}</span>
                  </span>
                </ListBox.Item>
              ))}
            </ListBox>
          ) : (
            <div className="text-muted flex h-20 items-center px-5 text-sm">No commands found</div>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function ReviewModelText({compact = false, model}: {compact?: boolean; model: ComposerModel}) {
  return (
    <span className={`composer-model-text ${compact ? "composer-model-text--compact" : ""} flex min-w-0 items-center gap-1`}>
      <span className="truncate font-normal">{compact ? model.id : model.name}</span>
      {model.meta ? <span className="shrink-0 font-normal text-muted">· {model.meta}</span> : null}
    </span>
  );
}

function ModelPickerMenu({
  defaultExpanded = false,
  isLoadingModels,
  model,
  models,
  modelsStatus,
  onClose,
  onRefreshModels,
  onReasoningChange,
  onSelectionChange,
  reasoningEffort,
  selectedKey,
  tuningStatus,
  variant = "popover",
}: {
  defaultExpanded?: boolean;
  isLoadingModels: boolean;
  model: ComposerModel;
  models: ComposerModel[];
  modelsStatus: string | null;
  onClose?: () => void;
  onRefreshModels: () => void;
  onReasoningChange: (value: ReasoningEffort) => void;
  onSelectionChange: (key: string) => void;
  reasoningEffort: ReasoningEffort;
  selectedKey: string;
  tuningStatus: string | null;
  variant?: "popover" | "sheet";
}) {
  const selectedReasoning = normalizeReasoningEffort(reasoningEffort);
  const modelOptions = models.length > 0 ? models : [model];
  const [isModelListExpanded, setIsModelListExpanded] = useState(defaultExpanded);

  return (
    <div className={`model-picker-menu model-picker-menu--${variant}`} data-models-expanded={isModelListExpanded}>
      <section aria-label="Reasoning effort" className="model-picker-panel model-picker-panel--reasoning">
        <div className="model-picker-heading">推理</div>
        <div className="model-picker-list">
          {MODEL_PICKER_REASONING_EFFORTS.map((effort) => {
            const selected = selectedReasoning === effort.value;
            return (
              <button
                key={effort.value}
                className="model-picker-row"
                data-selected={selected}
                type="button"
                onClick={() => onReasoningChange(effort.value)}
              >
                <span className="model-picker-row__label">{modelPickerReasoningLabel(effort.value)}</span>
                {selected ? <Check className="model-picker-check" /> : null}
              </button>
            );
          })}
        </div>
        <Separator className="model-picker-separator" />
        <button
          aria-expanded={isModelListExpanded}
          className="model-picker-row model-picker-row--branch"
          type="button"
          onClick={() => setIsModelListExpanded((current) => !current)}
        >
          <span className="model-picker-row__label">{modelPickerModelLabel(model)}</span>
          <ChevronRight className="model-picker-chevron" />
        </button>
        <button className="model-picker-refresh" type="button" onClick={onRefreshModels}>
          <span>{isLoadingModels ? "正在拉取模型" : "刷新上游模型"}</span>
          <RefreshCw className="size-3.5" />
        </button>
      </section>

      <section aria-hidden={!isModelListExpanded} aria-label="Model" className="model-picker-panel model-picker-panel--models">
        <div className="model-picker-heading">模型</div>
        <div className="model-picker-list">
          {modelOptions.map((option) => {
            const selected = option.id === selectedKey;
            return (
              <button
                key={option.id}
                className="model-picker-row"
                data-selected={selected}
                type="button"
                onClick={() => {
                  onSelectionChange(option.id);
                  onClose?.();
                }}
              >
                <span className="model-picker-row__label">{modelPickerModelLabel(option)}</span>
                {selected ? <Check className="model-picker-check" /> : null}
              </button>
            );
          })}
        </div>
        {modelsStatus || tuningStatus ? <div className="model-picker-status">{tuningStatus ?? modelsStatus}</div> : null}
      </section>
    </div>
  );
}

function ModelSelectControl({
  className,
  disabled,
  isLoadingModels,
  model,
  models,
  modelsStatus,
  onRefreshModels,
  onReasoningChange,
  onSelectionChange,
  popoverPlacement = "top",
  reasoningEffort,
  selectedKey,
  tuningStatus,
}: {
  className?: string;
  disabled: boolean;
  isLoadingModels: boolean;
  model: ComposerModel;
  models: ComposerModel[];
  modelsStatus: string | null;
  onRefreshModels: () => void;
  onReasoningChange: (value: ReasoningEffort) => void;
  onSelectionChange: (key: string) => void;
  popoverPlacement?: "top" | "top end" | "top start" | "bottom end" | "bottom start";
  reasoningEffort: ReasoningEffort;
  selectedKey: string;
  tuningStatus: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className={className}>
      <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger>
          <Button aria-label="Choose model" className="model-select-trigger" isDisabled={disabled} size="sm" variant="ghost">
            <ReviewModelText compact model={model} />
            <ChevronDown className="size-4 shrink-0 text-muted" />
          </Button>
        </Popover.Trigger>
        <Popover.Content className="model-picker-popover" containerPadding={12} offset={8} placement={popoverPlacement}>
          <Popover.Dialog className="model-picker-dialog">
            <ModelPickerMenu
              isLoadingModels={isLoadingModels}
              model={model}
              models={models}
              modelsStatus={modelsStatus}
              reasoningEffort={reasoningEffort}
              selectedKey={selectedKey}
              tuningStatus={tuningStatus}
              onClose={() => setIsOpen(false)}
              onRefreshModels={onRefreshModels}
              onReasoningChange={onReasoningChange}
              onSelectionChange={onSelectionChange}
            />
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </span>
  );
}

function MobileModelPickerBody({
  isLoadingModels,
  model,
  models,
  modelsStatus,
  onRefreshModels,
  onReasoningChange,
  onSelectionChange,
  reasoningEffort,
  selectedKey,
  tuningStatus,
}: {
  isLoadingModels: boolean;
  model: ComposerModel;
  models: ComposerModel[];
  modelsStatus: string | null;
  onRefreshModels: () => void;
  onReasoningChange: (value: ReasoningEffort) => void;
  onSelectionChange: (key: string) => void;
  reasoningEffort: ReasoningEffort;
  selectedKey: string;
  tuningStatus: string | null;
}) {
  const selectedReasoning = normalizeReasoningEffort(reasoningEffort);
  const modelOptions = models.length > 0 ? models : [model];
  const status = tuningStatus ?? modelsStatus;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-1.5">
        <div className="px-1 text-xs font-semibold text-muted">推理强度</div>
        <ListBox
          aria-label="Reasoning effort"
          className="w-full"
          disallowEmptySelection
          selectedKeys={new Set([selectedReasoning])}
          selectionMode="single"
          onSelectionChange={(keys) => {
            if (keys === "all") return;
            const first = [...keys][0];
            if (first != null) onReasoningChange(String(first) as ReasoningEffort);
          }}
        >
          {MODEL_PICKER_REASONING_EFFORTS.map((effort) => (
            <ListBox.Item key={effort.value} id={effort.value} textValue={modelPickerReasoningLabel(effort.value)}>
              <Label>{modelPickerReasoningLabel(effort.value)}</Label>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </section>

      <section className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-muted">模型</span>
          <Button isDisabled={isLoadingModels} size="sm" variant="ghost" onPress={onRefreshModels}>
            <RefreshCw className={`size-3.5 ${isLoadingModels ? "animate-spin" : ""}`} />
            <span className="text-xs">{isLoadingModels ? "拉取中" : "刷新"}</span>
          </Button>
        </div>
        <ListBox
          aria-label="Model"
          className="w-full"
          disallowEmptySelection
          selectedKeys={new Set([selectedKey])}
          selectionMode="single"
          onSelectionChange={(keys) => {
            if (keys === "all") return;
            const first = [...keys][0];
            if (first != null) onSelectionChange(String(first));
          }}
        >
          {modelOptions.map((option) => (
            <ListBox.Item key={option.id} id={option.id} textValue={modelPickerModelLabel(option)}>
              <div className="flex min-w-0 flex-col">
                <Label className="truncate">{modelPickerModelLabel(option)}</Label>
                {option.provider ? <Description className="truncate">{option.provider}</Description> : null}
              </div>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
        {status ? <p className="px-1 text-xs text-muted">{status}</p> : null}
      </section>
    </div>
  );
}

function MobileModelSheet({
  disabled,
  isLoadingModels,
  model,
  models,
  modelsStatus,
  onRefreshModels,
  onReasoningChange,
  onSelectionChange,
  reasoningEffort,
  selectedKey,
  tuningStatus,
}: {
  disabled: boolean;
  isLoadingModels: boolean;
  model: ComposerModel;
  models: ComposerModel[];
  modelsStatus: string | null;
  onRefreshModels: () => void;
  onReasoningChange: (value: ReasoningEffort) => void;
  onSelectionChange: (key: string) => void;
  reasoningEffort: ReasoningEffort;
  selectedKey: string;
  tuningStatus: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Close the sheet once a model change has actually committed (selectedKey updates
  // after the save round-trip). Doing it here, off the ListBox selection event,
  // avoids the save-driven re-render swallowing an inline setIsOpen(false).
  // Reasoning changes don't touch selectedKey, so they keep the sheet open.
  const committedModelKey = useRef(selectedKey);
  useEffect(() => {
    if (selectedKey !== committedModelKey.current) {
      committedModelKey.current = selectedKey;
      setIsOpen(false);
    }
  }, [selectedKey]);

  return (
    <Sheet isDetached isOpen={isOpen} placement="bottom" onOpenChange={setIsOpen}>
      <Sheet.Trigger>
        <Button
          aria-label="Choose model"
          className="model-select-trigger model-select-trigger--mobile"
          isDisabled={disabled}
          size="sm"
          variant="ghost"
        >
          <ReviewModelText compact model={model} />
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </Button>
      </Sheet.Trigger>
      <Sheet.Backdrop>
        <Sheet.Content className="model-sheet-content">
          <Sheet.Dialog className="model-sheet-dialog">
            <Sheet.Handle />
            <Sheet.Header className="items-start px-4 pb-2 pt-3">
              <Sheet.Heading className="text-base font-semibold">Model</Sheet.Heading>
              <p className="text-xs text-muted">
                <ReviewModelText compact model={model} />
              </p>
            </Sheet.Header>
            <Sheet.Body className="scrollbar min-h-0 overflow-y-auto px-4 pb-5">
              <MobileModelPickerBody
                isLoadingModels={isLoadingModels}
                model={model}
                models={models}
                modelsStatus={modelsStatus}
                reasoningEffort={reasoningEffort}
                selectedKey={selectedKey}
                tuningStatus={tuningStatus}
                onRefreshModels={onRefreshModels}
                onReasoningChange={onReasoningChange}
                onSelectionChange={onSelectionChange}
              />
            </Sheet.Body>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}

function SessionInsightPanel({
  modelStatus,
  session,
  turns,
  onSummarize,
}: {
  modelStatus: ModelStatusResponse | null;
  session: ChatSessionSummary | null;
  turns: ChatTurnSummary[];
  onSummarize: () => void;
}) {
  return (
    <aside className="hidden min-h-0 min-w-0 border-l border-separator bg-surface-secondary/60 xl:flex xl:flex-col">
      <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-separator px-4">
        <div>
          <div className="text-sm font-semibold">Session Insight</div>
          <div className="text-xs text-muted">{modelStatus?.configured ? "Model summaries available" : "Deterministic summaries"}</div>
        </div>
        <Button className="control-button" size="sm" variant="outline" onPress={onSummarize}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>
      <ScrollShadow className="min-h-0 flex-1 overflow-y-auto p-4" hideScrollBar>
        <div className="space-y-5">
          <section className="panel-section">
            <PanelTitle icon={<HeartPulse className="size-4" />} title="Session Summary" />
            <p className="text-sm leading-6 text-muted">{session?.summary || "No summary yet. Send a message to create one."}</p>
          </section>
          <section className="space-y-3">
            <PanelTitle icon={<MessageSquare className="size-4" />} title="Turn Summaries" />
            {turns.length === 0 ? (
              <p className="rounded-2xl bg-surface p-3 text-sm text-muted shadow-surface">No turns recorded for this session yet.</p>
            ) : (
              turns.map((turn, index) => (
                <div key={turn.id} className="rounded-2xl bg-surface p-3 shadow-surface">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">Turn {index + 1}</span>
                    <Chip color={statusTone(turn.status)} size="sm" variant="soft">
                      {turn.status}
                    </Chip>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">{turn.miniSummary}</p>
                </div>
              ))
            )}
          </section>
        </div>
      </ScrollShadow>
    </aside>
  );
}

function SettingsWorkspace({
  api,
  apiBase,
  health,
  healthMessage,
  jobs,
  memoryItems,
  modelStatus,
  sessionId,
  userId,
  onBack,
  onCheckHealth,
  onJob,
  onMemoryItems,
  onModelStatus,
  onNavigate,
  onRefreshMemories,
}: {
  api: ReturnType<typeof createApiClient>;
  apiBase: string;
  health: "checking" | "up" | "down";
  healthMessage: string;
  jobs: DocumentIngestJobResponse[];
  memoryItems: MemoryItem[];
  modelStatus: ModelStatusResponse | null;
  sessionId: number;
  userId: number;
  onBack: () => void;
  onCheckHealth: () => void;
  onJob: (job: DocumentIngestJobResponse) => void;
  onMemoryItems: (items: MemoryItem[]) => void;
  onModelStatus: (status: ModelStatusResponse) => void;
  onNavigate: (view: "chat" | "settings") => void;
  onRefreshMemories: () => void;
}) {
  return (
    <main className="settings-page flex h-svh min-w-0 flex-col overflow-hidden bg-background">
      <header className="settings-header flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-separator px-4 md:px-6">
        <div className="flex items-center gap-3">
          <DesktopSidebarTrigger />
          <MobileWorkspaceSheet health={health} view="settings" onNavigate={onNavigate} />
          <Button className="control-button header-action-button" size="sm" variant="outline" onPress={onBack}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <div>
            <h1 className="text-base font-semibold">Settings</h1>
            <p className="settings-header__subtitle text-muted">Runtime context, knowledge import, and memory management.</p>
          </div>
        </div>
        <Button
          aria-label="Refresh backend status"
          className="control-button header-action-button whitespace-nowrap"
          size="sm"
          variant="outline"
          onPress={onCheckHealth}
        >
          <RefreshCw className="size-4" />
          <span className="sm:hidden">Refresh</span>
          <span className="hidden sm:inline">Refresh status</span>
        </Button>
      </header>
      <ScrollShadow className="min-h-0 flex-1 overflow-y-auto" hideScrollBar>
        <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 md:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SettingsPanel
            api={api}
            apiBase={apiBase}
            health={health}
            healthMessage={healthMessage}
            modelStatus={modelStatus}
            sessionId={sessionId}
            userId={userId}
            onModelStatus={onModelStatus}
          />
          <IngestionPanel api={api} jobs={jobs} onJob={onJob} />
          <MemoryPanel
            api={api}
            items={memoryItems}
            sessionId={sessionId}
            userId={userId}
            onItems={onMemoryItems}
            onRefresh={onRefreshMemories}
          />
        </div>
      </ScrollShadow>
    </main>
  );
}

function SettingsPanel({
  api,
  apiBase,
  health,
  healthMessage,
  modelStatus,
  sessionId,
  userId,
  onModelStatus,
}: {
  api: ReturnType<typeof createApiClient>;
  apiBase: string;
  health: "checking" | "up" | "down";
  healthMessage: string;
  modelStatus: ModelStatusResponse | null;
  sessionId: number;
  userId: number;
  onModelStatus: (status: ModelStatusResponse) => void;
}) {
  return (
    <section className="space-y-5">
      <PanelTitle icon={<Settings className="size-4" />} title="Runtime Context" />
      <div className="panel-section runtime-context-panel" aria-label="Runtime context">
        <ReadOnlyField label="API base" value={apiBase} />
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyField label="User ID" value={userId} />
          <ReadOnlyField label="Session ID" value={sessionId} />
        </div>
      </div>
      <div className="panel-section">
        <PanelTitle icon={<HeartPulse className="size-4" />} title="Backend Status" />
        <div className="flex flex-wrap gap-2">
          <Chip color={health === "up" ? "success" : "danger"} variant="soft">
            {healthMessage}
          </Chip>
          <Chip color={modelStatus?.configured ? "success" : "warning"} variant="soft">
            {modelStatus?.message ?? "Model status unknown"}
          </Chip>
        </div>
        <p className="text-sm leading-6 text-muted">
          Provider: {modelStatus?.provider ?? "unknown"} · Model: {modelStatus?.model ?? "unknown"}
        </p>
      </div>
      <ModelConfigPanel api={api} modelStatus={modelStatus} onModelStatus={onModelStatus} />
    </section>
  );
}

function ModelConfigPanel({
  api,
  modelStatus,
  onModelStatus,
}: {
  api: ReturnType<typeof createApiClient>;
  modelStatus: ModelStatusResponse | null;
  onModelStatus: (status: ModelStatusResponse) => void;
}) {
  const [provider, setProvider] = useState(modelStatus?.provider ?? "openai-compatible");
  const [baseUrl, setBaseUrl] = useState(modelStatus?.baseUrl ?? "https://api.openai.com");
  const [model, setModel] = useState(modelStatus?.model ?? "gpt-5.4-mini");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(String(modelStatus?.temperature ?? 0.7));
  const [maxOutputTokens, setMaxOutputTokens] = useState(String(modelStatus?.maxOutputTokens ?? 1024));
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(normalizeReasoningEffort(modelStatus?.reasoningEffort));
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!modelStatus) return;
    setProvider(modelStatus.provider ?? "openai-compatible");
    setBaseUrl(modelStatus.baseUrl ?? "https://api.openai.com");
    setModel(modelStatus.model ?? "gpt-5.4-mini");
    setTemperature(String(modelStatus.temperature ?? 0.7));
    setMaxOutputTokens(String(modelStatus.maxOutputTokens ?? 1024));
    setReasoningEffort(normalizeReasoningEffort(modelStatus.reasoningEffort));
  }, [modelStatus]);

  async function saveModelConfig() {
    setStatus("Saving model configuration");
    try {
      const nextStatus = await api.updateModelConfig({
        provider,
        baseUrl,
        apiKey: apiKey.trim() || undefined,
        model,
        temperature: Number(temperature),
        maxOutputTokens: Number(maxOutputTokens),
        reasoningEffort: provider === "openai-compatible" ? reasoningEffort : undefined,
      });
      onModelStatus(nextStatus);
      setApiKey("");
      setStatus(nextStatus.configured ? "Model configuration saved" : nextStatus.message ?? "Model configuration saved");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  return (
    <div className="panel-section">
      <PanelTitle icon={<Gauge className="size-4" />} title="Model Configuration" />
      <p className="text-sm leading-6 text-muted">
        Runtime changes apply to new chat, agent, and RAG requests. API keys are accepted by the backend and never echoed back.
      </p>
      <Field label="Provider">
        <NativeSelect fullWidth>
          <NativeSelect.Trigger name="modelProvider" value={provider} onChange={(event) => setProvider(event.target.value)}>
            <NativeSelect.Option value="openai-compatible">OpenAI compatible</NativeSelect.Option>
            <NativeSelect.Option value="dashscope">DashScope</NativeSelect.Option>
            <NativeSelect.Indicator />
          </NativeSelect.Trigger>
        </NativeSelect>
      </Field>
      <Field label="Base URL">
        <input className="field-input" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
      </Field>
      <Field label="Model">
        <input className="field-input" value={model} onChange={(event) => setModel(event.target.value)} />
      </Field>
      {provider === "openai-compatible" ? (
        <Field label="Reasoning effort">
          <NativeSelect fullWidth>
            <NativeSelect.Trigger
              name="modelReasoningEffort"
              value={reasoningEffort}
              onChange={(event) => setReasoningEffort(event.target.value as ReasoningEffort)}
            >
              {REASONING_EFFORTS.map((effort) => (
                <NativeSelect.Option key={effort.value} value={effort.value}>
                  {effort.label}
                </NativeSelect.Option>
              ))}
              <NativeSelect.Indicator />
            </NativeSelect.Trigger>
          </NativeSelect>
        </Field>
      ) : null}
      <Field label="API key">
        <input
          className="field-input"
          placeholder={modelStatus?.configured ? "Leave blank to keep current key" : "Paste API key"}
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Temperature">
          <input className="field-input" step="0.1" type="number" value={temperature} onChange={(event) => setTemperature(event.target.value)} />
        </Field>
        <Field label="Max tokens">
          <input
            className="field-input"
            min={1}
            type="number"
            value={maxOutputTokens}
            onChange={(event) => setMaxOutputTokens(event.target.value)}
          />
        </Field>
      </div>
      <Button className="control-button settings-action-button" variant="outline" onPress={() => void saveModelConfig()}>
        Save Model
      </Button>
      {status ? <p className="text-sm leading-6 text-muted">{status}</p> : null}
    </div>
  );
}

function IngestionPanel({
  api,
  jobs,
  onJob,
}: {
  api: ReturnType<typeof createApiClient>;
  jobs: DocumentIngestJobResponse[];
  onJob: (job: DocumentIngestJobResponse) => void;
}) {
  const [textTitle, setTextTitle] = useState("");
  const [textFileName, setTextFileName] = useState("workspace-note.md");
  const [textContent, setTextContent] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function ingestText() {
    setStatus("Submitting text ingestion");
    try {
      const job = await api.ingestText({title: textTitle, fileName: textFileName, content: textContent, sourceType: "manual_text"});
      onJob(job);
      setStatus("Text ingestion job submitted");
      setTextContent("");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function ingestUpload(file: File | undefined) {
    if (!file) return;
    setStatus("Uploading document");
    try {
      const job = await api.uploadDocument(file);
      onJob(job);
      setStatus("Upload job submitted");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function ingestLocalPath() {
    setStatus("Submitting local path");
    try {
      const job = await api.ingestLocalPath(localPath);
      onJob(job);
      setStatus("Local path job submitted");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  return (
    <section className="space-y-5">
      <PanelTitle icon={<FileInput className="size-4" />} title="Knowledge Import" />
      <div className="panel-section">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileInput className="size-4" />
          Text Import
        </div>
        <Field label="Title">
          <input className="field-input" value={textTitle} onChange={(event) => setTextTitle(event.target.value)} />
        </Field>
        <Field label="File name">
          <input className="field-input" value={textFileName} onChange={(event) => setTextFileName(event.target.value)} />
        </Field>
        <Field label="Content">
          <textarea className="field-input min-h-28 resize-y" value={textContent} onChange={(event) => setTextContent(event.target.value)} />
        </Field>
        <Button className="settings-action-button" isDisabled={!textContent.trim()} onPress={() => void ingestText()}>
          Submit Text
        </Button>
      </div>
      <div className="panel-section">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Upload className="size-4" />
          File Upload
        </div>
        <input
          className="field-input file:mr-3 file:rounded-xl file:border-0 file:bg-surface-secondary file:px-3 file:py-1.5 file:text-sm"
          type="file"
          onChange={(event) => void ingestUpload(event.target.files?.[0])}
        />
      </div>
      <div className="panel-section">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileUp className="size-4" />
          Local Path
        </div>
        <Field label="Server path">
          <input className="field-input" value={localPath} onChange={(event) => setLocalPath(event.target.value)} />
        </Field>
        <Button className="settings-action-button" isDisabled={!localPath.trim()} variant="outline" onPress={() => void ingestLocalPath()}>
          Submit Path
        </Button>
      </div>
      {status ? <div className="rounded-2xl bg-surface p-3 text-sm text-muted shadow-surface">{status}</div> : null}
      <div className="space-y-3">
        <PanelTitle icon={<RefreshCw className="size-4" />} title="Ingestion Jobs" />
        {jobs.length === 0 ? (
          <p className="rounded-2xl bg-surface p-3 text-sm text-muted shadow-surface">No ingestion jobs submitted from this workspace yet.</p>
        ) : (
          jobs.map((job) => (
            <div key={job.jobId} className="rounded-2xl bg-surface p-3 shadow-surface">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium">{job.fileName ?? job.path ?? job.jobId}</span>
                <JobStatus status={job.status} />
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">{job.message ?? job.jobId}</p>
              {job.chunkCount !== undefined ? <p className="mt-1 text-xs text-muted">{job.chunkCount} chunks</p> : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function JobStatus({status}: {status: string}) {
  const success = status === "SUCCEEDED";
  const failed = status === "FAILED";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
        success ? "bg-success/15 text-success" : failed ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning"
      }`}
    >
      {success ? <CheckCircle2 className="size-3" /> : failed ? <XCircle className="size-3" /> : <RefreshCw className="size-3" />}
      {status}
    </span>
  );
}

function MemoryPanel({
  api,
  items,
  sessionId,
  userId,
  onItems,
  onRefresh,
}: {
  api: ReturnType<typeof createApiClient>;
  items: MemoryItem[];
  sessionId: number;
  userId: number;
  onItems: (items: MemoryItem[]) => void;
  onRefresh: () => void;
}) {
  const [memoryType, setMemoryType] = useState<MemoryType>("IMPORTANT_FACT");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function writeMemory() {
    if (!content.trim()) return;
    setStatus("Writing memory");
    try {
      await api.writeMemory({userId, sessionId, memoryType, content, summary, confidence: 0.9, source: "frontend_workspace"});
      const freshItems = await api.listUserMemories(userId, 20);
      onItems(freshItems);
      setContent("");
      setSummary("");
      setStatus("Memory written");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  return (
    <section className="space-y-5 xl:col-span-2">
      <PanelTitle icon={<Brain className="size-4" />} title="Memory" />
      <div className="panel-section">
        <NativeSelect fullWidth>
          <Label>Type</Label>
          <NativeSelect.Trigger name="memoryType" value={memoryType} onChange={(event) => setMemoryType(event.target.value as MemoryType)}>
            {MEMORY_TYPES.map((type) => (
              <NativeSelect.Option key={type} value={type}>
                {type}
              </NativeSelect.Option>
            ))}
            <NativeSelect.Indicator />
          </NativeSelect.Trigger>
        </NativeSelect>
        <Field label="Content">
          <textarea className="field-input min-h-24 resize-y" value={content} onChange={(event) => setContent(event.target.value)} />
        </Field>
        <Field label="Summary">
          <input className="field-input" value={summary} onChange={(event) => setSummary(event.target.value)} />
        </Field>
        <div className="settings-action-row">
          <Button className="settings-action-button" isDisabled={!content.trim()} onPress={() => void writeMemory()}>
            Write
          </Button>
          <Button className="settings-action-button" variant="outline" onPress={onRefresh}>
            Refresh
          </Button>
        </div>
      </div>
      {status ? <div className="rounded-2xl bg-surface p-3 text-sm text-muted shadow-surface">{status}</div> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {items.length === 0 ? (
          <p className="rounded-2xl bg-surface p-3 text-sm text-muted shadow-surface">No memories loaded for this user. Use Refresh or write a memory.</p>
        ) : (
          items.map((item) => (
            <div key={item.memoryId} className="rounded-2xl bg-surface p-3 shadow-surface">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{item.memoryType ?? "Memory"}</span>
                <span className="rounded-full bg-surface-secondary px-2 py-1 text-xs text-muted">{item.status ?? "ACTIVE"}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground">{item.summary || item.content}</p>
              {item.content && item.summary ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{item.content}</p> : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function PanelTitle({icon, title}: {icon: React.ReactNode; title: string}) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      <span className="text-muted">{icon}</span>
      {title}
    </div>
  );
}

function Field({children, label}: {children: React.ReactNode; label: string}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function ReadOnlyField({label, value}: {label: string; value: number | string}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="readonly-field" title={String(value)}>
        {value}
      </div>
    </div>
  );
}

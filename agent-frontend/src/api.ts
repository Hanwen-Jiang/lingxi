import type {
  AdaptiveRagResponse,
  AgentResponse,
  AutoChatResponse,
  BaseResponse,
  ChatRequest,
  ChatResponse,
  ChatSessionCreateRequest,
  ChatSessionDetail,
  ChatSessionSummary,
  DocumentIngestJobResponse,
  HealthResponse,
  MemoryItem,
  MemoryType,
  ModelConfigRequest,
  ModelListResponse,
  ModelStatusResponse,
  RagQueryResponse,
  StreamChatEvent,
} from "./types";

// Same-origin relative base. In prod the gateway/edge serves the SPA and
// forwards /api/** to the agent (D1/D3); in dev Vite proxies /api (see
// vite.config.ts). Override the whole base with VITE_API_BASE_URL to target a
// non-default backend. (Was hardcoded to http://localhost:10010/api, which is
// the chat gateway port — a bug; the agent is reached via /api, not :10010.)
const DEFAULT_API_BASE = "/api";

export class ApiError extends Error {
  code?: number;
  status?: number;

  constructor(message: string, options: {code?: number; status?: number} = {}) {
    super(message);
    this.name = "ApiError";
    this.code = options.code;
    this.status = options.status;
  }
}

export function getDefaultApiBase() {
  return import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE;
}

function trimBase(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

export function parseSsePayload(chunk: string) {
  const events: StreamChatEvent[] = [];
  const blocks = chunk.split(/\n\n/);

  for (const block of blocks) {
    const dataLines = block
      .split(/\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());

    if (dataLines.length === 0) continue;

    const payload = dataLines.join("\n").trim();

    if (!payload || payload === "[DONE]") continue;

    try {
      events.push(JSON.parse(payload) as StreamChatEvent);
    } catch {
      events.push({type: "delta", text: payload});
    }
  }

  return {events, tail: blocks.at(-1)?.endsWith("\n\n") ? "" : (blocks.at(-1) ?? "")};
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient(apiBase: string) {
  const baseUrl = trimBase(apiBase);

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {"Content-Type": "application/json", ...(init?.headers ?? {})},
      ...init,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("json")
      ? ((await response.json()) as BaseResponse<T> | T)
      : await response.text();

    if (!response.ok) {
      const message =
        typeof body === "object" && body && "message" in body
          ? String((body as BaseResponse<T>).message)
          : `HTTP ${response.status}`;

      throw new ApiError(message, {status: response.status});
    }

    if (typeof body === "object" && body && "code" in body && "data" in body) {
      const wrapped = body as BaseResponse<T>;

      if (wrapped.code !== 200) {
        throw new ApiError(wrapped.message || "Request failed", {code: wrapped.code});
      }

      return wrapped.data;
    }

    return body as T;
  }

  return {
    baseUrl,
    health: () => request<HealthResponse>("/actuator/health", {method: "GET"}),
    modelStatus: () => request<ModelStatusResponse>("/chat/model-status", {method: "GET"}),
    listModels: () => request<ModelListResponse>("/chat/models", {method: "GET"}),
    updateModelConfig: (payload: ModelConfigRequest) =>
      request<ModelStatusResponse>("/chat/model-config", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    listSessions: (userId: number, limit = 40) =>
      request<ChatSessionSummary[]>(
        `/chat/sessions?userId=${encodeURIComponent(userId)}&limit=${encodeURIComponent(limit)}`,
        {
          method: "GET",
        },
      ),
    getSession: (userId: number, sessionId: number) =>
      request<ChatSessionDetail>(
        `/chat/sessions/${encodeURIComponent(sessionId)}?userId=${encodeURIComponent(userId)}`,
        {method: "GET"},
      ),
    createSession: (payload: ChatSessionCreateRequest) =>
      request<ChatSessionSummary>("/chat/sessions", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    summarizeSession: (userId: number, sessionId: number) =>
      request<ChatSessionSummary>(
        `/chat/sessions/${encodeURIComponent(sessionId)}/summarize?userId=${encodeURIComponent(userId)}`,
        {method: "POST"},
      ),
    chat: (payload: ChatRequest) => request<ChatResponse>("/chat", {method: "POST", body: JSON.stringify(payload)}),
    autoChat: (payload: ChatRequest) =>
      request<AutoChatResponse>("/chat/auto", {method: "POST", body: JSON.stringify(payload)}),
    ragChat: (payload: ChatRequest) =>
      request<RagQueryResponse>("/rag/chat", {method: "POST", body: JSON.stringify(payload)}),
    adaptiveRagChat: (payload: ChatRequest & {debug?: boolean}) =>
      request<AdaptiveRagResponse>("/rag/adaptive/chat", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    agentChat: (payload: ChatRequest & {debug?: boolean; confirmedTools?: string[]}) =>
      request<AgentResponse>("/agent/chat", {method: "POST", body: JSON.stringify(payload)}),
    listAgentTools: () => request<unknown[]>("/agent/tools", {method: "GET"}),
    ingestText: (payload: {fileName?: string; title?: string; content: string; sourceType?: string}) =>
      request<DocumentIngestJobResponse>("/rag/documents/text", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    ingestLocalPath: (path: string) =>
      request<DocumentIngestJobResponse>("/rag/documents/local-ingest", {
        method: "POST",
        body: JSON.stringify({path}),
      }),
    uploadDocument: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${baseUrl}/rag/documents/upload`, {
        method: "POST",
        body: formData,
      });

      const body = (await response.json()) as BaseResponse<DocumentIngestJobResponse>;

      if (!response.ok || body.code !== 200) {
        throw new ApiError(body.message || `HTTP ${response.status}`, {
          code: body.code,
          status: response.status,
        });
      }

      return body.data;
    },
    getIngestJob: (jobId: string) =>
      request<DocumentIngestJobResponse>(`/rag/documents/jobs/${encodeURIComponent(jobId)}`, {
        method: "GET",
      }),
    writeMemory: (payload: {
      userId: number;
      sessionId: number;
      memoryType: MemoryType;
      content: string;
      summary?: string;
      confidence?: number;
      source?: string;
    }) => request<MemoryItem>("/memory/write", {method: "POST", body: JSON.stringify(payload)}),
    listUserMemories: (userId: number, limit = 20, memoryType?: MemoryType) => {
      const params = new URLSearchParams({limit: String(limit)});
      if (memoryType) params.set("memoryType", memoryType);

      return request<MemoryItem[]>(`/memory/user/${userId}?${params.toString()}`, {method: "GET"});
    },
    streamChat: async (payload: ChatRequest, onEvent: (event: StreamChatEvent) => void, signal?: AbortSignal) => {
      const response = await fetch(`${baseUrl}/streamChat`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok || !response.body) {
        throw new ApiError(`Stream failed with HTTP ${response.status}`, {status: response.status});
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const {done, value} = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {stream: true});
        const {events, tail} = parseSsePayload(buffer);
        buffer = tail;
        events.forEach(onEvent);
      }

      if (buffer.trim()) {
        parseSsePayload(`${buffer}\n\n`).events.forEach(onEvent);
      }
    },
    autoStreamChat: async (payload: ChatRequest, onEvent: (event: StreamChatEvent) => void, signal?: AbortSignal) => {
      const response = await fetch(`${baseUrl}/chat/auto/stream`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok || !response.body) {
        throw new ApiError(`Auto stream failed with HTTP ${response.status}`, {status: response.status});
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const {done, value} = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {stream: true});
        const {events, tail} = parseSsePayload(buffer);
        buffer = tail;
        events.forEach(onEvent);
      }

      if (buffer.trim()) {
        parseSsePayload(`${buffer}\n\n`).events.forEach(onEvent);
      }
    },
  };
}

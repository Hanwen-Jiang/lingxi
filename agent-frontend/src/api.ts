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
  LoginCodeRequest,
  LoginRequest,
  LoginResponse,
  MemoryItem,
  MemoryType,
  ModelConfigRequest,
  ModelListResponse,
  ModelStatusResponse,
  RagQueryResponse,
  RegisterRequest,
  SendMailRequest,
  SendMailResponse,
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

function extractEnvelopeMessage(body: unknown): string | null {
  if (typeof body === "object" && body && "message" in body) {
    const message = (body as {message?: unknown}).message;
    return typeof message === "string" ? message : null;
  }
  return null;
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

export type ApiClientOptions = {
  // Called for every request to inject Authorization. Return null/undefined to
  // send no Authorization header (e.g. for the login/health endpoints).
  getAccessToken?: () => string | null | undefined;
  // Called when the backend signals an authenticated request failed identity
  // verification (HTTP 401 OR the per-contract 40100 code). The auth layer
  // wires this to clear the session and redirect to /auth. Don't throw here —
  // we still throw the ApiError so the caller can show a banner.
  onUnauthorized?: () => void;
};

// Per docs/planning/03-contracts.md §2 — the success code is `0`. We were
// originally written against the legacy `200` shape, so for the expand/
// contract window (S1/S3 翻 envelope) we accept either. Either reduces to
// "data is the meaningful payload, message is for surfacing if non-zero".
const ENVELOPE_SUCCESS_CODES = new Set([0, 200]);
const UNAUTHENTICATED_CODES = new Set([40100]);

export function createApiClient(apiBase: string, options: ApiClientOptions = {}) {
  const baseUrl = trimBase(apiBase);

  function authHeaders(): Record<string, string> {
    const token = options.getAccessToken?.();
    return token ? {Authorization: `Bearer ${token}`} : {};
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {"Content-Type": "application/json", ...authHeaders(), ...(init?.headers ?? {})},
      ...init,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("json")
      ? ((await response.json()) as BaseResponse<T> | T)
      : await response.text();

    // Real HTTP status takes precedence (per contract §3: stop "always-200 +
    // body code"). 401 means re-auth no matter what the body says.
    if (response.status === 401) {
      options.onUnauthorized?.();
      throw new ApiError(extractEnvelopeMessage(body) ?? "登录已失效,请重新登录。", {
        status: 401,
        code: typeof body === "object" && body && "code" in body ? Number((body as BaseResponse<T>).code) : undefined,
      });
    }

    if (!response.ok) {
      throw new ApiError(extractEnvelopeMessage(body) ?? `HTTP ${response.status}`, {status: response.status});
    }

    if (typeof body === "object" && body && "code" in body && "data" in body) {
      const wrapped = body as BaseResponse<T>;

      // Body-code-level unauthenticated (still surfaces as 401 in §3's mapping,
      // but for the legacy "always-200" servers we tolerate it via this check).
      if (UNAUTHENTICATED_CODES.has(wrapped.code)) {
        options.onUnauthorized?.();
        throw new ApiError(wrapped.message || "登录已失效,请重新登录。", {code: wrapped.code, status: 401});
      }

      if (!ENVELOPE_SUCCESS_CODES.has(wrapped.code)) {
        throw new ApiError(wrapped.message || "请求失败,请稍后再试。", {code: wrapped.code});
      }

      return wrapped.data;
    }

    return body as T;
  }

  return {
    baseUrl,
    // chat-backend Auth (per 03-contracts.md §7.1 D14 — email model).
    sendMail: (payload: SendMailRequest) =>
      request<SendMailResponse>("/v1/user/sendMail", {method: "POST", body: JSON.stringify(payload)}),
    register: (payload: RegisterRequest) =>
      request<LoginResponse>("/v1/user/register", {method: "POST", body: JSON.stringify(payload)}),
    login: (payload: LoginRequest) =>
      request<LoginResponse>("/v1/user/login", {method: "POST", body: JSON.stringify(payload)}),
    loginCode: (payload: LoginCodeRequest) =>
      request<LoginResponse>("/v1/user/loginCode", {method: "POST", body: JSON.stringify(payload)}),
    refresh: (refreshToken: string) =>
      request<LoginResponse>("/v1/user/refresh", {method: "POST", body: JSON.stringify({refreshToken})}),
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

      // Multipart upload — do NOT set Content-Type, let the browser do the
      // boundary. Still inject Authorization so the request authenticates.
      const response = await fetch(`${baseUrl}/rag/documents/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });

      if (response.status === 401) {
        options.onUnauthorized?.();
        throw new ApiError("登录已失效,请重新登录。", {status: 401});
      }

      const body = (await response.json()) as BaseResponse<DocumentIngestJobResponse>;

      if (!response.ok || !ENVELOPE_SUCCESS_CODES.has(body.code)) {
        throw new ApiError(body.message || `上传失败,请稍后再试。`, {
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
        headers: {"Content-Type": "application/json", ...authHeaders()},
        body: JSON.stringify(payload),
        signal,
      });

      if (response.status === 401) {
        options.onUnauthorized?.();
        throw new ApiError("登录已失效,请重新登录。", {status: 401});
      }
      if (!response.ok || !response.body) {
        throw new ApiError(`连接灵犀失败,请稍后再试。`, {status: response.status});
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
        headers: {"Content-Type": "application/json", ...authHeaders()},
        body: JSON.stringify(payload),
        signal,
      });

      if (response.status === 401) {
        options.onUnauthorized?.();
        throw new ApiError("登录已失效,请重新登录。", {status: 401});
      }
      if (!response.ok || !response.body) {
        throw new ApiError(`连接灵犀失败,请稍后再试。`, {status: response.status});
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

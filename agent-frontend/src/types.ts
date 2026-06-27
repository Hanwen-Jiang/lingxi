export type BaseResponse<T> = {
  code: number;
  data: T;
  message: string;
  // Per docs/planning/03-contracts.md §2, the gateway also injects these.
  // Optional here because the legacy envelope omits them — expand/contract.
  traceId?: string;
  timestamp?: number;
};

export type HealthResponse = {
  status?: string;
  components?: Record<string, unknown>;
};

// chat-backend Auth (POST /api/v1/user/login). Per S3's known bug,
// LoginResponse.userId is currently null and the real id only lives in the
// JWT sub claim — the auth layer falls back to decoding sub when userId is
// missing. Phone-vs-email is the chat-backend Auth UX; we keep `account` as
// the contract-agnostic input field name (S3 may pivot to email).
export type LoginRequest = {
  phone: string;
  password: string;
};

export type LoginResponse = {
  userId: string | null;
  userName?: string;
  avatar?: string;
  signature?: string;
  gender?: number;
  status?: number;
  token: string;
  // Refresh token is not in the current response — S3 still owes us
  // POST /api/v1/user/refresh. We tolerate either shape.
  refreshToken?: string;
};

export type ChatRequest = {
  userId: number;
  sessionId: number;
  prompt: string;
};

export type ChatResponse = {
  sessionId: number;
  answer: string;
};

export type AutoRouteId = "direct" | "agent" | "adaptive-rag" | "rag" | "draft" | string;

export type AutoChatResponse = {
  route: AutoRouteId;
  forced: boolean;
  reason?: string;
  answer?: string;
  citations?: Citation[];
  toolTrace?: unknown;
  requestId?: string;
  status?: "SUCCESS" | "ERROR" | string;
  errorMessage?: string;
};

export type StreamChatEvent = {
  type: "start" | "delta" | "usage" | "done" | "error" | string;
  requestId?: string;
  sessionId?: number;
  text?: string;
  code?: number;
  message?: string;
  route?: AutoRouteId;
  forced?: boolean;
  reason?: string;
  citations?: Citation[];
  toolTrace?: unknown;
  inputTokens?: number;
  outputTokens?: number;
};

export type Citation = {
  index?: number;
  docId?: string;
  chunkId?: string;
  fileName?: string;
  chunkIndex?: number;
  sectionTitle?: string;
  headingPath?: string;
  pageNumber?: number;
  snippet?: string;
  retrievalSource?: string;
  vectorScore?: number;
  keywordScore?: number;
  fusionScore?: number;
  rerankScore?: number;
};

export type RagQueryResponse = {
  answer?: string;
  citations?: Citation[];
  hit?: boolean;
  answered?: boolean;
  retrievalHit?: boolean;
  needFollowUp?: boolean;
  retrievedCount?: number;
  candidateCount?: number;
  costMs?: number;
  retrievalCostMs?: number;
  modelCostMs?: number;
  estimatedInputTokens?: number;
  contextTruncated?: boolean;
};

export type AdaptiveRagResponse = RagQueryResponse & {
  strategy?: string;
  rounds?: number;
  debug?: unknown;
};

export type AgentResponse = {
  answer?: string;
  finalAction?: string;
  strategy?: string;
  citations?: Citation[];
  reactTrace?: unknown[];
  costMs?: number;
  modelCostMs?: number;
  retrievalCostMs?: number;
  estimatedInputTokens?: number;
  contextTruncated?: boolean;
  memoryTrace?: unknown;
  toolGovernance?: unknown;
};

export type DocumentIngestJobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | string;

export type DocumentIngestJobResponse = {
  jobId: string;
  status: DocumentIngestJobStatus;
  sourceType?: string;
  fileName?: string;
  path?: string;
  chunkCount?: number;
  message?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MemoryType =
  | "USER_PREFERENCE"
  | "PROJECT_CONTEXT"
  | "TECH_STACK"
  | "OUTPUT_STYLE"
  | "IMPORTANT_FACT"
  | "REFLECTION";

export type MemoryItem = {
  memoryId: string;
  userId: number;
  sessionId?: number;
  memoryType?: MemoryType;
  content?: string;
  summary?: string;
  confidence?: number;
  source?: string;
  status?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ChatSessionSummary = {
  userId: number;
  sessionId: number;
  title: string;
  mode: ChatModeId | string;
  summary?: string;
  turnCount?: number;
  lastStatus?: "SUCCESS" | "ERROR" | string;
  lastMessageAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ChatTurnSummary = {
  id: number;
  userId: number;
  sessionId: number;
  mode: ChatModeId | string;
  prompt: string;
  answer?: string;
  status: "SUCCESS" | "ERROR" | string;
  requestId?: string;
  miniSummary?: string;
  errorMessage?: string;
  metadataJson?: string;
  createdAt?: string;
};

export type ChatSessionDetail = {
  session: ChatSessionSummary;
  turns: ChatTurnSummary[];
};

export type ChatSessionCreateRequest = {
  userId: number;
  sessionId?: number;
  mode?: ChatModeId | string;
  title?: string;
};

export type ModelStatusResponse = {
  provider?: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
  maxOutputTokens?: number;
  reasoningEffort?: ReasoningEffort;
  configured?: boolean;
  runtimeEditable?: boolean;
  message?: string;
};

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | string;

export type ModelConfigRequest = {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  reasoningEffort?: ReasoningEffort;
};

export type ModelOption = {
  id: string;
  ownedBy?: string;
};

export type ModelListResponse = {
  provider?: string;
  baseUrl?: string;
  configured?: boolean;
  source?: "upstream" | "configured" | string;
  message?: string;
  models: ModelOption[];
};

export type ChatModeId = "auto" | "direct" | "agent" | "rag" | "adaptive-rag" | "draft" | "stream";

export type ChatMode = {
  id: ChatModeId;
  label: string;
  description: string;
  tone: "chat" | "agent" | "knowledge";
};

export type MessageStatus = "sending" | "streaming" | "complete" | "error";

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export type WorkspaceMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status?: MessageStatus;
  modeId?: ChatModeId;
  requestId?: string;
  citations?: Citation[];
  meta?: Record<string, unknown>;
};

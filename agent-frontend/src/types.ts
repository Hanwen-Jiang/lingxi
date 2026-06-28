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

// chat-backend Auth, email model (D14 / 03-contracts.md §7.1). All identity
// is keyed on email; the legacy phone field is removed from the contract.
// Five endpoints back the login UI:
//   POST /api/v1/user/sendMail   → {email}
//   POST /api/v1/user/register   → {email, password, code}   → LoginResponse
//   POST /api/v1/user/login      → {email, password}         → LoginResponse
//   POST /api/v1/user/loginCode  → {email, code}             → LoginResponse
//   POST /api/v1/user/refresh    → {refreshToken}            → LoginResponse
// LoginResponse.userId is the sub string id (S3 unit1b fix) and refreshToken
// is included (HS256, access ≈30m / refresh ≈7d).
export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginCodeRequest = {
  email: string;
  code: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  code: string;
};

export type SendMailRequest = {
  email: string;
};

// chat-backend MailResponse just carries a status string ("ok"); we don't
// rely on the body shape because the contract only promises success/failure
// via HTTP status + envelope code.
export type SendMailResponse = {
  status?: string;
};

export type LoginResponse = {
  userId: string | null;
  userName?: string;
  avatar?: string;
  signature?: string;
  gender?: number;
  status?: number;
  token: string;
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

// A tool the agent wants to run but is holding for human confirmation (M4).
// The wire shape is owned by S1's F01 (tool-confirmation challenge token), which
// is not shipped yet — lib/chat.extractPendingTools parses it defensively out of
// `toolGovernance` so this stays the single seam to adapt when F01 lands. The
// `name` is what we echo back in confirmedTools[]; challengeToken (when present)
// is threaded through untouched.
export type PendingTool = {
  name: string;
  title?: string;
  description?: string;
  args?: unknown;
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

// Per D10: model-config is an admin-only screen and the request never carries
// an apiKey from the client (server reads its env-bound key; sending one here
// would let any caller exfiltrate it via SSRF). The field is intentionally
// absent from the type so any accidental client-side use fails at tsc.
export type ModelConfigRequest = {
  provider?: string;
  baseUrl?: string;
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

// Real Api branch. Same signatures as the mock (一处切): flipping VITE_API_BASE
// swaps the data source without touching any screen. Wires the endpoints S3 has
// DELIVERED + verified (P3 auth §7.1; P4 item1 sessions/history/friends/markRead;
// B8 WS handshake). Write-side (sendMessage → S3 item2 outbox), friend applies,
// and the assistant SSE (agent/S1) are NOT yet contract-closed here, so they
// delegate to the mock until delivered — "先接已交付的,未交付的续 Mock".
import type {Api, ListMessagesOptions, SendResult, UploadedMedia} from "./contract";
import {mockApi} from "./mock";
import {
  ApiError,
  apiUrl,
  type LoginResponseRaw,
  mapSession,
  request,
  uploadToPresignedUrl,
  wsOrigin,
} from "./http";
import {extractBufferedAnswer, mapAssistantEvent, parseSseChunk, SSE_SCHEMA_V} from "./sse";
import type {
  Conversation,
  ConversationKind,
  Friend,
  Id,
  Message,
  MessageKind,
  Page,
  User,
} from "./types";
import {createWebSocketTransport, type WsTransport} from "./ws/transport";
import {useAuthStore} from "@/store/auth";

// --- Identity (derived from the auth session) --------------------------------
function currentUser(): User | null {
  const s = useAuthStore.getState().session;
  return s ? {id: s.userId, name: s.userName, avatar: s.avatar} : null;
}

// Best-effort name/avatar cache for rendering sender chips. The list endpoints
// don't carry per-message sender info yet (no members/user-info endpoint shipped),
// so we cache who we learn about (friends) and fall back to senderId otherwise.
const userCache: Record<Id, User> = {};
function remember(u: User): void {
  if (u.id) userCache[u.id] = u;
}

// Send needs sessionType (1 single / 2 group) and, for a single chat, the peer's
// userId as `receiveUserId`. Both come from the session list now: type from
// `type`, peer from `peerUserId` (S3 `3929842` — so a cold-open single chat with
// no prior message can send too). We still learn the peer from inbound history as
// a fallback for any list item that predates the field.
const sessionTypeById: Record<Id, number> = {};
const sessionPeerById: Record<Id, Id> = {};

// Real backend session ids are snowflakes (numeric strings). The in-IM 灵犀
// assistant rides a client-only id ("s-lingxi") that has no IM session, so we
// skip its IM history/read calls. Agent P11 closed D5: assistant sessionId is a
// string boundary now, so streamAssistant sends the string id as-is.
const isBackendSessionId = (id: Id): boolean => /^\d+$/.test(String(id));

// --- Wire → domain mappers ----------------------------------------------------
interface SessionListItemRaw {
  sessionId: string;
  type: number; // SessionType: 1 SINGLE, 2 GROUP
  name: string;
  avatar?: string | null;
  lastMessage?: string | MessageItemRaw | null;
  lastMessageTime?: number | null;
  unreadCount?: number | null;
  peerUserId?: string | null; // single-chat peer userId (S3 `3929842`); null for groups
}

interface MessageItemRaw {
  messageId: string;
  sessionId: string;
  senderId: string;
  type: number;
  content: string;
  replyId?: string | null;
  createdAt: number | string;
}

interface FriendListItemRaw {
  friendId: string;
  nickname: string;
  avatar?: string | null;
  signature?: string | null;
  status?: number | null;
}

// Backend message-type codes (MessageRcvTypeEnum / SessionType). Sending uses the
// inverse: text→TEXT, image→PICTURE. Only TEXT+PICTURE round-trip realtime today.
const MSG_TYPE = {TEXT: 1, PICTURE: 2, FILE: 3, VIDEO: 4, RED_PACKET: 5} as const;
const SESSION_TYPE = {SINGLE: 1, GROUP: 2} as const;

// Agent endpoint for the in-IM 灵犀 assistant, reached through the chat gateway.
// J1 (agent/docs/E2E-INTEGRATION §1) routes /api/chat|chat/auto|chat/auto/stream +
// /api/agent|rag|memory to the agent (gateway injects X-User-Id). We use the
// auto-routing SSE route: a direct chat streams token-by-token, while agent/RAG/
// tool routes send the whole answer in one frame (§9 `buffered:true`) — the
// dual-mode consumer below renders both. (P6 fell back to /api/agent/chat because
// the chat gateway hadn't yet routed /api/chat/** — J1 added that route.)
const ASSISTANT_STREAM_PATH = "/api/chat/auto/stream";

// Message content type → client kind. Mirrors MessageRcvTypeEnum (server-side).
function mapMessageKind(type: number): MessageKind {
  switch (type) {
    case MSG_TYPE.PICTURE:
      return "image";
    case MSG_TYPE.RED_PACKET:
      return "redpacket";
    default:
      // TEXT + (FILE/VIDEO/EMOTICON not yet modeled client-side) render as text.
      return "text";
  }
}

function mapMessage(r: MessageItemRaw): Message {
  const me = useAuthStore.getState().session?.userId;
  const createdAt = typeof r.createdAt === "number" ? r.createdAt : Number(r.createdAt) || 0;
  return {
    id: String(r.messageId),
    sessionId: String(r.sessionId),
    senderId: String(r.senderId),
    kind: mapMessageKind(r.type),
    content: r.content,
    createdAt,
    // Server history carries no per-viewer delivery state; mine read, others delivered.
    delivery: String(r.senderId) === me ? "read" : "delivered",
  };
}

function mapConversation(r: SessionListItemRaw): Conversation {
  if (r.sessionId) sessionTypeById[String(r.sessionId)] = r.type ?? SESSION_TYPE.SINGLE;
  // Cold-open single-chat send: learn the peer straight from the list (S3 `3929842`).
  if (r.sessionId && r.peerUserId) sessionPeerById[String(r.sessionId)] = String(r.peerUserId);
  const kind: ConversationKind = r.type === 2 ? "group" : "single";
  let lastMessage: Message | undefined;
  if (r.lastMessage && typeof r.lastMessage === "object") {
    lastMessage = mapMessage(r.lastMessage);
  } else if (typeof r.lastMessage === "string" && r.lastMessage) {
    // A preview string (no message object) — synthesize a minimal bubble for the list.
    lastMessage = {
      id: "",
      sessionId: String(r.sessionId),
      senderId: "",
      kind: "text",
      content: r.lastMessage,
      createdAt: r.lastMessageTime ?? 0,
      delivery: "delivered",
    };
  }
  return {
    id: String(r.sessionId),
    kind,
    title: r.name,
    avatar: r.avatar ?? undefined,
    memberIds: [], // not in the list item; filled when a members endpoint lands
    lastMessage,
    lastMessageTime: r.lastMessageTime ?? lastMessage?.createdAt,
    unreadCount: r.unreadCount ?? 0,
    muted: false,
  };
}

function mapFriend(r: FriendListItemRaw): Friend {
  return {
    id: String(r.friendId),
    name: r.nickname,
    avatar: r.avatar ?? undefined,
    signature: r.signature ?? undefined,
  };
}

// Cursor-paginated envelope (§4).
interface PageRaw<T> {
  items?: T[] | null;
  nextCursor?: string | null;
  hasMore?: boolean | null;
}

// Auth endpoints reject with a bare status (the gateway/Auth 401 has no envelope
// body), so a generic "session expired" message would be wrong on the sign-in
// form. Translate by context to copy that matches the mock (AuthPage shows it).
function authError(err: unknown, opts: {badCreds?: string; conflict?: string} = {}): Error {
  if (err instanceof ApiError) {
    if (err.status === 422 && err.fieldErrors?.length) return new Error(err.fieldErrors[0].message);
    if ((err.status === 401 || err.status === 400) && opts.badCreds) return new Error(opts.badCreds);
    if (err.status === 409 && opts.conflict) return new Error(opts.conflict);
    return new Error(err.message);
  }
  return err instanceof Error ? err : new Error("请求失败,请稍后重试");
}

// --- Send wire shapes ---------------------------------------------------------
interface SendMsgResponseRaw {
  sessionId: string;
  sessionType?: number;
  type?: number;
  messageId: string; // serialized as string by the gateway's ToStringSerializer
  body?: unknown;
  createdAt?: string;
}

interface MediaUploadRaw {
  uploadUrl: string;
  fileUrl: string;
  objectKey: string;
  method?: string;
  contentType?: string;
  expiresInSec?: number;
  maxSizeBytes?: number;
}

/**
 * POST /api/v1/chat/session. Ids ride as JSON strings (snowflakes exceed JS's
 * safe-int range; the gateway coerces string→Long, so precision is preserved).
 * `sendUserId` MUST equal the authenticated subject (server enforces 403). For a
 * single chat the backend needs `receiveUserId` (the peer); we supply the peer
 * learned from the thread (sessionPeerById) — see note above.
 */
async function postSend(sessionId: Id, type: number, body: unknown): Promise<SendMsgResponseRaw> {
  const me = useAuthStore.getState().session?.userId;
  if (!me) throw new ApiError(401, "登录已过期,请重新登录");
  const sessionType = sessionTypeById[String(sessionId)] ?? SESSION_TYPE.SINGLE;
  const payload: Record<string, unknown> = {
    sessionId: String(sessionId),
    sendUserId: me,
    sessionType,
    type,
    body,
  };
  if (sessionType === SESSION_TYPE.SINGLE) {
    const peer = sessionPeerById[String(sessionId)];
    if (!peer) throw new ApiError(400, "无法确定接收方,请打开会话后重试");
    payload.receiveUserId = peer;
  }
  return request<SendMsgResponseRaw>("/api/v1/chat/session", {method: "POST", body: payload});
}

/** Build the reconciled domain Message from a send response (real messageId) +
 *  the locally-known content. We keep client time for `createdAt` so the bubble
 *  doesn't jump on reconcile (the server returns a TZ-less "yyyy-MM-dd HH:mm:ss"). */
function reconciledMessage(res: SendMsgResponseRaw, sessionId: Id, kind: MessageKind, content: string): Message {
  const me = useAuthStore.getState().session?.userId ?? "";
  return {
    id: String(res.messageId),
    sessionId: String(sessionId),
    senderId: me,
    kind,
    content,
    createdAt: Date.now(),
    delivery: "sent",
  };
}

// --- Real Api ----------------------------------------------------------------
export const realApi: Api = {
  me(): User {
    return currentUser() ?? {id: "", name: ""};
  },

  userMap(): Record<Id, User> {
    const me = currentUser();
    return {...userCache, ...(me ? {[me.id]: me} : {})};
  },

  // --- Auth (§7.1 · D14; public endpoints — no Authorization, no 401-replay) ---
  async sendMail(email: string): Promise<void> {
    await request<void>("/api/v1/user/sendMail", {
      method: "POST",
      body: {email},
      auth: false,
      retry: false,
    });
  },

  async login(email, password) {
    try {
      const data = await request<LoginResponseRaw>("/api/v1/user/login", {
        method: "POST",
        body: {email, password},
        auth: false,
        retry: false,
      });
      return mapSession(data);
    } catch (e) {
      throw authError(e, {badCreds: "邮箱或密码不正确"});
    }
  },

  async loginCode(email, code) {
    try {
      const data = await request<LoginResponseRaw>("/api/v1/user/loginCode", {
        method: "POST",
        body: {email, code},
        auth: false,
        retry: false,
      });
      return mapSession(data);
    } catch (e) {
      throw authError(e, {badCreds: "邮箱或验证码不正确"});
    }
  },

  async register(email, password, code) {
    try {
      const data = await request<LoginResponseRaw>("/api/v1/user/register", {
        method: "POST",
        body: {email, password, code},
        auth: false,
        retry: false,
      });
      return mapSession(data);
    } catch (e) {
      throw authError(e, {badCreds: "验证码不正确或已过期", conflict: "该邮箱已注册,请直接登录"});
    }
  },

  async refresh(refreshToken) {
    const data = await request<LoginResponseRaw>("/api/v1/user/refresh", {
      method: "POST",
      body: {refreshToken},
      auth: false,
      retry: false,
    });
    return mapSession(data);
  },

  // --- Client read APIs (P4 item1 — delivered + E2E-verified) ---
  async listConversations(): Promise<Conversation[]> {
    const data = await request<SessionListItemRaw[]>("/api/v1/chat/sessions");
    return (data ?? []).map(mapConversation);
  },

  async listMessages(sessionId: Id, opts: ListMessagesOptions = {}): Promise<Page<Message>> {
    // Client-only conversation (the 灵犀 assistant) — no IM history endpoint; its
    // thread is built locally from the stream, so return empty instead of 400ing.
    if (!isBackendSessionId(sessionId)) return {items: [], hasMore: false};
    const {cursor, limit = 20} = opts;
    const q = new URLSearchParams();
    if (cursor) q.set("cursor", cursor);
    q.set("limit", String(limit));
    const page = await request<PageRaw<MessageItemRaw>>(
      `/api/v1/chat/session/${encodeURIComponent(sessionId)}/messages?${q.toString()}`,
    );
    // Backend keysets message_id DESC (newest first); the thread renders ascending
    // (oldest→newest), so reverse this page for display.
    const items = (page?.items ?? []).map(mapMessage).reverse();
    // Learn the single-chat peer for the send path: any sender that isn't me.
    const me = useAuthStore.getState().session?.userId;
    for (const m of items) {
      if (m.senderId && m.senderId !== me) sessionPeerById[String(sessionId)] = m.senderId;
    }
    return {items, nextCursor: page?.nextCursor ?? undefined, hasMore: page?.hasMore ?? false};
  },

  async listFriends(): Promise<Friend[]> {
    const page = await request<PageRaw<FriendListItemRaw>>(
      "/api/v1/contact/friends?limit=100&status=1",
    );
    const friends = (page?.items ?? []).map(mapFriend);
    friends.forEach(remember);
    return friends;
  },

  async markRead(sessionId: Id): Promise<void> {
    if (!isBackendSessionId(sessionId)) return; // client-only assistant session — nothing to mark
    // body omits lastReadMessageId → server marks the session's latest as read.
    await request<string>(`/api/v1/chat/sessions/${encodeURIComponent(sessionId)}/read`, {
      method: "POST",
      body: {},
    });
  },

  // --- WS (B8: ?token=&userUuid= query — gateway/Netty verify sub==userUuid) ---
  openWs(): WsTransport {
    const s = useAuthStore.getState().session;
    // createWebSocketTransport runs buildHandshake internally (mode "query" =
    // the B8 default S3 finalized). Token/userUuid come from the live session.
    return createWebSocketTransport({
      gatewayWsOrigin: wsOrigin(),
      token: s?.token ?? "",
      userUuid: s?.userId ?? "",
      mode: "query",
    });
  },

  // --- Send (POST /api/v1/chat/session — chat-common Result, P5 item2/3) ---
  async sendMessage(sessionId: Id, content: string): Promise<SendResult> {
    const res = await postSend(sessionId, MSG_TYPE.TEXT, {content});
    return {message: reconciledMessage(res, sessionId, "text", content)};
  },

  // --- Media (M11: presigned PUT → embed fileUrl in an image message) ---
  async uploadMedia(file: File): Promise<UploadedMedia> {
    const contentType = file.type || "application/octet-stream";
    const presign = await request<MediaUploadRaw>("/api/v1/user/media/upload-url", {
      method: "POST",
      body: {fileName: file.name, contentType, size: file.size},
    });
    await uploadToPresignedUrl(presign.method || "PUT", presign.uploadUrl, file, presign.contentType || contentType);
    return {fileUrl: presign.fileUrl, objectKey: presign.objectKey, contentType: presign.contentType || contentType};
  },

  async sendImageMessage(sessionId: Id, fileUrl: string, size?: number): Promise<SendResult> {
    const res = await postSend(sessionId, MSG_TYPE.PICTURE, {url: fileUrl, size});
    return {message: reconciledMessage(res, sessionId, "image", fileUrl)};
  },

  // --- Not yet contract-closed → delegate to the mock (续 Mock) ---
  // Friend applies: not in item1 handoff.
  listApplies() {
    return mockApi.listApplies();
  },
  respondApply(applyId: Id, accept: boolean) {
    return mockApi.respondApply(applyId, accept);
  },
  // --- Assistant SSE (灵犀 in-IM · §9) — streams from the agent via the gateway.
  // Dual-mode: parse the SSE event stream when the server streams, or render a
  // buffered JSON envelope as a single delta (agent/adaptive routes send the whole
  // answer in one frame — §9 `buffered:true`). Unknown event types are tolerated
  // (mapAssistantEvent drops them). Returns an abort function (matches the mock).
  streamAssistant(sessionId, content, onEvent) {
    const controller = new AbortController();
    let aborted = false;
    const fail = (message: string) => {
      if (!aborted) onEvent({type: "error", v: SSE_SCHEMA_V, message});
    };

    void (async () => {
      let res: Response;
      try {
        const token = useAuthStore.getState().session?.token;
        res = await fetch(apiUrl(ASSISTANT_STREAM_PATH), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...(token ? {Authorization: `Bearer ${token}`} : {}),
          },
          // D3: the gateway injects X-User-Id; we never send userId in the body.
          // D5/P11: agent accepts string sessionId, including client-only
          // assistant ids such as "s-lingxi".
          body: JSON.stringify({sessionId: String(sessionId), prompt: content}),
          signal: controller.signal,
        });
      } catch {
        fail("连接灵犀失败,请稍后再试");
        return;
      }

      if (!res.ok || !res.body) {
        fail(res.status === 401 ? "登录已过期,请重新登录" : "连接灵犀失败,请稍后再试");
        return;
      }

      // Non-SSE (buffered) response: render the whole answer as one delta.
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        const answer = extractBufferedAnswer(await res.text());
        if (aborted) return;
        if (answer) onEvent({type: "delta", v: SSE_SCHEMA_V, text: answer, buffered: true});
        onEvent({type: "done", v: SSE_SCHEMA_V});
        return;
      }

      // SSE stream: accumulate, parse §9 events, map, emit. We re-parse the live
      // buffer each read and keep only the incomplete tail, so each complete event
      // is emitted exactly once.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawDone = false;
      const flush = () => {
        const {events, tail} = parseSseChunk(buffer);
        buffer = tail;
        for (const raw of events) {
          if (aborted) return;
          const mapped = mapAssistantEvent(raw);
          if (!mapped) continue;
          if (mapped.type === "done") sawDone = true;
          onEvent(mapped);
        }
      };

      try {
        for (;;) {
          const {done, value} = await reader.read();
          if (done) break;
          if (aborted) return;
          buffer += decoder.decode(value, {stream: true});
          flush();
        }
        if (buffer.trim() && !aborted) {
          buffer += "\n\n";
          flush();
        }
        // Clear the bubble's streaming state even if the server closed without an
        // explicit `done` frame.
        if (!aborted && !sawDone) onEvent({type: "done", v: SSE_SCHEMA_V});
      } catch {
        fail("灵犀连接中断,请稍后再试");
      }
    })();

    return () => {
      aborted = true;
      controller.abort();
    };
  },
};

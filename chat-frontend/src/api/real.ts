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
  type LoginResponseRaw,
  mapSession,
  request,
  uploadToPresignedUrl,
  wsOrigin,
} from "./http";
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
// userId as `receiveUserId` — neither of which the session-list item carries. We
// learn both as the user browses: type from the session list, peer from any
// inbound message in a single thread (senderId !== me). 交接 S3: exposing
// `peerUserId` on SessionListItem would make single-chat send robust from a cold
// open (a brand-new single thread with no peer message yet can't be derived).
const sessionTypeById: Record<Id, number> = {};
const sessionPeerById: Record<Id, Id> = {};

// --- Wire → domain mappers ----------------------------------------------------
interface SessionListItemRaw {
  sessionId: string;
  type: number; // SessionType: 1 SINGLE, 2 GROUP
  name: string;
  avatar?: string | null;
  lastMessage?: string | MessageItemRaw | null;
  lastMessageTime?: number | null;
  unreadCount?: number | null;
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
  // Assistant stream: agent SSE (/api/agent/chat) is S1's domain (§6).
  streamAssistant(sessionId, content, onEvent) {
    return mockApi.streamAssistant(sessionId, content, onEvent);
  },
};

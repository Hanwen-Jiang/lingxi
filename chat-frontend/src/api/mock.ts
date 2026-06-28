// Mock implementation of the API seam. Until S3 ships B6/B7/B8/M9/M10/M11, every
// screen runs on this. It deliberately simulates REAL states — latency, empty,
// optimistic send, assistant streaming, WS push — because the demoted prototype
// only ever modeled "always success" (40-plan §1 risk note).
import type {Api, SendResult} from "./contract";
import type {
  AuthSession,
  Conversation,
  Friend,
  FriendApply,
  Message,
  Page,
  PushEvent,
  User,
} from "./types";
import {decodeFrame, encodeFrame, OUT, PUSH, type WireFrame, type WsTransport} from "./ws/transport";

const ME: User = {id: "u-me", name: "我", presence: "online", signature: "在线"};

const PEOPLE: Record<string, User> = {
  "u-ada": {id: "u-ada", name: "周明", presence: "online", signature: "在做会话服务联调"},
  "u-lin": {id: "u-lin", name: "林清扬", presence: "away"},
  "u-grace": {id: "u-grace", name: "高文", presence: "offline"},
  "u-lingxi": {id: "u-lingxi", name: "灵犀", presence: "online", signature: "懂你的助手"},
};

const now = Date.now ? () => Date.now() : () => 0;
const T0 = 1_750_000_000_000; // fixed base so mock timestamps are deterministic
let seq = 1000;
const nextId = () => `m-${seq++}`;
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function msg(
  sessionId: string,
  senderId: string,
  content: string,
  minutesAgo: number,
  kind: Message["kind"] = "text",
): Message {
  return {
    id: nextId(),
    sessionId,
    senderId,
    kind,
    content,
    createdAt: T0 - minutesAgo * 60_000,
    delivery: senderId === ME.id ? "read" : "delivered",
  };
}

const messages: Record<string, Message[]> = {
  "s-ada": [
    msg("s-ada", "u-ada", "新的会话服务联调好了吗?", 32),
    msg("s-ada", "u-me", "网关路由打通了,正在搭前端壳。", 30),
    msg("s-ada", "u-ada", "太好了,等你截图看看。", 28),
  ],
  "s-team": [
    msg("s-team", "u-grace", "周会改到下午三点。", 120),
    msg("s-team", "u-lin", "收到。", 118),
    msg("s-team", "u-me", "我把设计系统的进度同步到台账了。", 90),
  ],
  "s-lingxi": [
    msg("s-lingxi", "u-lingxi", "你好,我是灵犀。可以帮你梳理消息、回顾重点、起草回复。", 5),
  ],
};

const conversations: Conversation[] = [
  conv("s-lingxi", "assistant", "灵犀", ["u-me", "u-lingxi"], 0),
  conv("s-ada", "single", "周明", ["u-me", "u-ada"], 1),
  conv("s-team", "group", "核心开发组", ["u-me", "u-grace", "u-lin", "u-lingxi"], 0, true),
];

function conv(
  id: string,
  kind: Conversation["kind"],
  title: string,
  memberIds: string[],
  unreadCount: number,
  muted = false,
): Conversation {
  const list = messages[id] ?? [];
  const last = list[list.length - 1];
  return {
    id,
    kind,
    title,
    memberIds,
    unreadCount,
    muted,
    lastMessage: last,
    lastMessageTime: last?.createdAt,
  };
}

const friends: Friend[] = Object.values(PEOPLE)
  .filter((u) => u.id !== "u-lingxi")
  .map((u) => ({id: u.id, name: u.name, signature: u.signature, presence: u.presence}));

const applies: FriendApply[] = [
  {
    id: "a-1",
    fromUser: {id: "u-new", name: "陈舟"},
    reason: "我是陈舟,一起做灵犀吧。",
    createdAt: T0 - 60 * 60_000,
    status: "pending",
  },
];

// --- WS transport simulation (single channel, like the backend) ---
// Emits backend-shaped wire frames into the active transport so the real WsClient
// (reconnect/heartbeat/ack/dedup) is exercised end-to-end against the mock.
let activeTransport: WsTransport | null = null;
// at-least-once: msgUuids awaiting a client ACK. If still unacked after a short
// delay we redeliver once (exercises the client's dedup + re-ACK path).
const unacked = new Set<string>();

function emit(e: PushEvent) {
  if (!activeTransport) return;
  const frame = pushEventToFrame(e);
  activeTransport.onmessage?.(encodeFrame(frame));
  if (frame.msgUuid) {
    const uuid = frame.msgUuid;
    unacked.add(uuid);
    setTimeout(() => {
      if (unacked.has(uuid)) activeTransport?.onmessage?.(encodeFrame(frame));
    }, 600);
  }
}

function pushEventToFrame(e: PushEvent): WireFrame {
  switch (e.type) {
    case "message":
      return {type: PUSH.MESSAGE, msgUuid: `2:${ME.id}:${e.message.id}`, data: e.message};
    case "new-session":
      return {type: PUSH.NEW_SESSION, msgUuid: `1:${ME.id}:${e.sessionId}`, data: {sessionId: e.sessionId}};
    case "friend-application":
      return {type: PUSH.FRIEND_APPLICATION, msgUuid: `4:${ME.id}:apply`};
    default:
      return {type: 0};
  }
}

/** Canned 灵犀 reply — product-facing copy only (no implementation wording). */
function assistantReplyFor(content: string): string {
  const q = content.trim();
  if (/总结|梳理|回顾|重点/.test(q)) {
    return "好的,我帮你梳理一下:核心开发组今天把周会改到了下午三点;周明在等你的联调进展。要我把这两件整理成待办吗?";
  }
  if (/起草|回复|写|措辞/.test(q)) {
    return "这是一版草稿,发送前你可以再改:「收到,我下午三点参加周会;联调那边我整理好就同步给你。」需要更轻松或更正式的语气吗?";
  }
  if (/你好|在吗|hi|hello/i.test(q)) {
    return "你好,我是灵犀。可以帮你梳理消息、起草回复、回顾要点 —— 直接说想做什么就行。";
  }
  return `收到。关于「${q}」,我可以帮你梳理重点、起草回复,或回顾相关上下文。告诉我下一步想怎么做。`;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Mock auth session — keeps ME's identity so the IM's "我" stays consistent. */
function mockSession(): AuthSession {
  return {
    userId: ME.id,
    userName: ME.name,
    avatar: ME.avatar,
    token: `mock-jwt-${nextId()}`,
    refreshToken: `mock-refresh-${nextId()}`,
  };
}

export const mockApi: Api = {
  me: () => ME,
  userMap: () => ({[ME.id]: ME, ...PEOPLE}),

  // --- Auth (D14 email model; no phone/SMS) ---
  async sendMail(email) {
    await delay(420);
    if (!EMAIL_RE.test(email)) throw new Error("请输入有效的邮箱地址");
  },
  async login(email, password) {
    await delay(520);
    if (!EMAIL_RE.test(email)) throw new Error("请输入有效的邮箱地址");
    // Mock rule: any email + a ≥6-char password signs in; shorter shows the error state.
    if (!password || password.length < 6) throw new Error("邮箱或密码不正确");
    return mockSession();
  },
  async loginCode(email, code) {
    await delay(520);
    if (!EMAIL_RE.test(email)) throw new Error("请输入有效的邮箱地址");
    if (!/^\d{6}$/.test(code)) throw new Error("验证码应为 6 位数字");
    return mockSession();
  },
  async register(email, password, code) {
    await delay(640);
    if (!EMAIL_RE.test(email)) throw new Error("请输入有效的邮箱地址");
    if (password.length < 6) throw new Error("密码至少 6 位");
    if (!/^\d{6}$/.test(code)) throw new Error("验证码应为 6 位数字");
    return mockSession();
  },
  async refresh(_refreshToken) {
    await delay(180);
    return mockSession();
  },

  async listConversations() {
    await delay(140);
    return structuredClone(conversations).sort(
      (a, b) => (b.lastMessageTime ?? 0) - (a.lastMessageTime ?? 0),
    );
  },

  async listMessages(sessionId, {limit = 20} = {}): Promise<Page<Message>> {
    await delay(180);
    const all = messages[sessionId] ?? [];
    // newest `limit` (cursor pagination is exercised by the real branch / B6).
    return {items: structuredClone(all).slice(-limit), nextCursor: undefined, hasMore: false};
  },

  async listFriends() {
    await delay(120);
    return structuredClone(friends);
  },

  async listApplies() {
    await delay(120);
    return structuredClone(applies);
  },

  async respondApply(applyId, accept) {
    await delay(150);
    const apply = applies.find((a) => a.id === applyId);
    if (!apply || apply.status !== "pending") return;
    apply.status = accept ? "accepted" : "rejected";
    if (accept && !friends.some((f) => f.id === apply.fromUser.id)) {
      friends.push({
        id: apply.fromUser.id,
        name: apply.fromUser.name,
        presence: apply.fromUser.presence,
      });
    }
  },

  async sendMessage(sessionId, content): Promise<SendResult> {
    // The HTTP send path. Caller renders the optimistic bubble; this resolves to
    // the server-assigned message (real id), to be reconciled by clientTempId.
    await delay(260);
    const saved: Message = {
      id: nextId(),
      sessionId,
      senderId: ME.id,
      kind: "text",
      content,
      createdAt: now() || T0,
      delivery: "sent",
    };
    messages[sessionId] = [...(messages[sessionId] ?? []), saved];
    // Assistant conversations stream via streamAssistant (not this HTTP path).
    return {message: saved};
  },

  async uploadMedia(file) {
    // Simulate the presign + PUT round-trip; the object URL stands in for the CDN
    // fileUrl so the image actually renders against the mock.
    await delay(360);
    const fileUrl = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(file) : "";
    return {fileUrl, objectKey: `mock/${nextId()}`, contentType: file.type || "image/*"};
  },

  async sendImageMessage(sessionId, fileUrl): Promise<SendResult> {
    await delay(220);
    const saved: Message = {
      id: nextId(),
      sessionId,
      senderId: ME.id,
      kind: "image",
      content: fileUrl,
      createdAt: now() || T0,
      delivery: "sent",
    };
    messages[sessionId] = [...(messages[sessionId] ?? []), saved];
    return {message: saved};
  },

  streamAssistant(_sessionId, content, onEvent) {
    // SSE-shaped mock: a thinking latency, then char-by-char deltas, then done.
    // P2 swaps this for a parser over the real `/api/agent/chat` SSE stream.
    let aborted = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const chars = [...assistantReplyFor(content)];
    // Chunk into ~5 phrase-sized deltas (real SSE sends token chunks, not single
    // chars). Keeping the delta count low matters in dev, where each re-render of
    // the unminified HeroUI tree is heavy; production renders are far cheaper.
    const take = Math.max(10, Math.ceil(chars.length / 5));
    let i = 0;
    timers.push(
      setTimeout(() => {
        if (aborted) return;
        onEvent({type: "start", v: 1});
        const step = () => {
          if (aborted) return;
          if (i >= chars.length) {
            onEvent({type: "usage", v: 1, tokens: chars.length});
            onEvent({type: "done", v: 1});
            return;
          }
          onEvent({type: "delta", v: 1, text: chars.slice(i, i + take).join("")});
          i += take;
          timers.push(setTimeout(step, 90));
        };
        step();
      }, 320),
    );
    return () => {
      aborted = true;
      timers.forEach(clearTimeout);
    };
  },

  async markRead(sessionId) {
    await delay(60);
    const c = conversations.find((x) => x.id === sessionId);
    if (c) c.unreadCount = 0;
  },

  openWs(): WsTransport {
    // A simulated single channel. The WsClient drives reconnect/heartbeat/ack on
    // top of this; here we just open after a short delay and ignore inbound
    // ACK/heartbeat frames the client sends.
    const t: WsTransport = {
      send(data) {
        // Honor client ACK (stop redelivery); ignore HEART_BEAT.
        const frame = decodeFrame(data);
        if (frame?.type === OUT.ACK && frame.msgUuid) unacked.delete(frame.msgUuid);
      },
      close() {
        if (activeTransport === t) activeTransport = null;
      },
    };
    activeTransport = t;
    setTimeout(() => t.onopen?.(), 80);
    return t;
  },
};

/** Dev-only: drop the active WS so the WsClient's reconnect path (and the
 *  `reconnecting` banner) can be exercised on Mock. Bound to `window.__lingxiDropWs`. */
export function __simulateWsDrop() {
  activeTransport?.onclose?.(false);
}

/** Dev-only: simulate an incoming message from another user via WS push — exercises
 *  the real P2 path (push → dedup → cache + unread badge). Bound to `window.__lingxiIncoming`. */
export function __simulateIncomingMessage(sessionId = "s-ada") {
  const senderId = sessionId === "s-ada" ? "u-ada" : "u-lin";
  const incoming: Message = {
    id: nextId(),
    sessionId,
    senderId,
    kind: "text",
    content: "刚看到你的进度,赞!晚点细聊。",
    createdAt: now() || T0,
    delivery: "delivered",
  };
  messages[sessionId] = [...(messages[sessionId] ?? []), incoming];
  const c = conversations.find((x) => x.id === sessionId);
  if (c) {
    c.lastMessage = incoming;
    c.lastMessageTime = incoming.createdAt;
    c.unreadCount += 1;
  }
  emit({type: "message", message: incoming});
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  const w = window as Window & {__lingxiDropWs?: () => void; __lingxiIncoming?: (s?: string) => void};
  w.__lingxiDropWs = __simulateWsDrop;
  w.__lingxiIncoming = __simulateIncomingMessage;
}

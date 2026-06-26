// Mock implementation of the API seam. Until S3 ships B6/B7/B8/M9/M10/M11, every
// screen runs on this. It deliberately simulates REAL states — latency, empty,
// optimistic send, assistant streaming, WS push — because the demoted prototype
// only ever modeled "always success" (40-plan §1 risk note).
import type {Api, SendResult} from "./contract";
import type {Conversation, Friend, FriendApply, Message, Page, PushEvent, User} from "./types";

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

// --- WS push simulation (single subscriber, like the single-channel backend) ---
let pushHandler: ((e: PushEvent) => void) | null = null;
function emit(e: PushEvent) {
  pushHandler?.(e);
}

export const mockApi: Api = {
  me: () => ME,
  userMap: () => ({[ME.id]: ME, ...PEOPLE}),

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
    return {items: structuredClone(all).slice(-limit), nextCursor: undefined};
  },

  async listFriends() {
    await delay(120);
    return structuredClone(friends);
  },

  async listApplies() {
    await delay(120);
    return structuredClone(applies);
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
    // The assistant "灵犀" replies via a simulated WS push (assistant-in-IM).
    if (sessionId === "s-lingxi") {
      setTimeout(() => {
        const reply: Message = {
          id: nextId(),
          sessionId,
          senderId: "u-lingxi",
          kind: "text",
          content: "收到。接入真实网关后,这里会换成 /api/agent/chat 的流式回复。",
          createdAt: (now() || T0) + 1,
          delivery: "delivered",
        };
        messages[sessionId] = [...(messages[sessionId] ?? []), reply];
        emit({type: "message", message: reply});
      }, 700);
    }
    return {message: saved};
  },

  async markRead(sessionId) {
    await delay(60);
    const c = conversations.find((x) => x.id === sessionId);
    if (c) c.unreadCount = 0;
  },

  connectWs(onPush) {
    pushHandler = onPush;
    return () => {
      if (pushHandler === onPush) pushHandler = null;
    };
  },
};

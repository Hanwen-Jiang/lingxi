// API layer. When `VITE_API_BASE` is configured we issue real REST calls against
// the GateWay; otherwise everything resolves against an in-memory mock so the UI
// runs standalone with zero backend dependencies.
import type {Conversation, FriendApply, Message, Result, User} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;
const USE_MOCK = !API_BASE;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {"Content-Type": "application/json"},
    ...init,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  const body = (await res.json()) as Result<T>;
  if (body.code !== 0 && body.code !== 200) throw new Error(body.message);
  return body.data;
}

// ---------------------------------------------------------------------------
// Mock fixtures
// ---------------------------------------------------------------------------
const ME: User = {
  uuid: "u-me",
  username: "我",
  avatar: avatarFor("我", "#3b82f6"),
  signature: "在线开发中",
};

const PEOPLE: User[] = [
  {uuid: "u-ada", username: "Ada Lovelace", avatar: avatarFor("AL", "#a855f7")},
  {uuid: "u-lin", username: "林清扬", avatar: avatarFor("林", "#10b981")},
  {uuid: "u-grace", username: "Grace Hopper", avatar: avatarFor("GH", "#f59e0b")},
  {uuid: "u-bot", username: "InfiniteBot", avatar: avatarFor("∞", "#ef4444")},
];

function avatarFor(text: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="16" fill="${color}"/><text x="50%" y="54%" font-family="sans-serif" font-size="32" fill="white" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

let seq = 100;
const nextId = () => `m-${seq++}`;
const now = () => Date.now();

const mockMessages: Record<string, Message[]> = {
  "s-ada": [
    msg("s-ada", "u-ada", "嘿,新的会话服务联调好了吗?", -1000 * 60 * 32),
    msg("s-ada", "u-me", "刚把网关路由配通,正在写前端。", -1000 * 60 * 30),
    msg("s-ada", "u-ada", "漂亮 🎉 截图发我看看", -1000 * 60 * 28),
  ],
  "s-group": [
    msg("s-group", "u-grace", "周会改到下午三点。", -1000 * 60 * 120),
    msg("s-group", "u-lin", "收到~", -1000 * 60 * 118),
    msg("s-group", "u-bot", "已为本群创建提醒。", -1000 * 60 * 117, "system"),
  ],
  "s-bot": [msg("s-bot", "u-bot", "你好!我是 InfiniteBot,有什么可以帮你?", -1000 * 60 * 5)],
};

function msg(
  sessionId: string,
  senderUuid: string,
  content: string,
  offset: number,
  kind: Message["kind"] = "text",
): Message {
  return {
    id: nextId(),
    sessionId,
    senderUuid,
    kind,
    content,
    createdAt: now() + offset,
    state: "read",
  };
}

const mockConversations: Conversation[] = [
  {
    sessionId: "s-ada",
    kind: "single",
    title: "Ada Lovelace",
    avatar: PEOPLE[0].avatar,
    memberUuids: ["u-me", "u-ada"],
    unread: 1,
    muted: false,
    lastMessage: last("s-ada"),
  },
  {
    sessionId: "s-group",
    kind: "group",
    title: "核心开发组",
    avatar: avatarFor("组", "#6366f1"),
    memberUuids: ["u-me", "u-grace", "u-lin", "u-bot"],
    unread: 0,
    muted: true,
    lastMessage: last("s-group"),
  },
  {
    sessionId: "s-bot",
    kind: "single",
    title: "InfiniteBot",
    avatar: PEOPLE[3].avatar,
    memberUuids: ["u-me", "u-bot"],
    unread: 0,
    muted: false,
    lastMessage: last("s-bot"),
  },
];

function last(sessionId: string): Message | undefined {
  const list = mockMessages[sessionId];
  return list?.[list.length - 1];
}

const mockApplies: FriendApply[] = [
  {
    id: "a-1",
    fromUser: PEOPLE[1],
    reason: "我是林清扬,一起做 InfiniteChat 吧",
    createdAt: now() - 1000 * 60 * 60,
    status: "pending",
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export const api = {
  me(): User {
    return ME;
  },

  userMap(): Record<string, User> {
    const all = [ME, ...PEOPLE];
    return Object.fromEntries(all.map((u) => [u.uuid, u]));
  },

  async conversations(): Promise<Conversation[]> {
    if (USE_MOCK) {
      await delay(120);
      return structuredClone(mockConversations);
    }
    return call<Conversation[]>("/api/v1/chat/conversations");
  },

  async messages(sessionId: string): Promise<Message[]> {
    if (USE_MOCK) {
      await delay(150);
      return structuredClone(mockMessages[sessionId] ?? []);
    }
    return call<Message[]>(`/api/v1/chat/session/${sessionId}/messages`);
  },

  async send(sessionId: string, content: string): Promise<Message> {
    const message: Message = {
      id: nextId(),
      sessionId,
      senderUuid: ME.uuid,
      kind: "text",
      content,
      createdAt: now(),
      state: "sending",
    };
    if (USE_MOCK) {
      mockMessages[sessionId] = [...(mockMessages[sessionId] ?? []), message];
      await delay(220);
      message.state = "sent";
      maybeBotReply(sessionId);
      return message;
    }
    // POST /api/v1/chat/session  (MessagingService SendMsgController)
    const saved = await call<Message>("/api/v1/chat/session", {
      method: "POST",
      body: JSON.stringify({sessionId, content, kind: "text"}),
    });
    return saved;
  },

  async applies(): Promise<FriendApply[]> {
    if (USE_MOCK) {
      await delay(100);
      return structuredClone(mockApplies);
    }
    return call<FriendApply[]>(`/api/v1/contact/${ME.uuid}/apply`);
  },
};

/** In mock mode, the bot echoes a canned reply so the chat feels alive. */
function maybeBotReply(sessionId: string) {
  if (sessionId !== "s-bot") return;
  const reply: Message = {
    id: nextId(),
    sessionId,
    senderUuid: "u-bot",
    kind: "text",
    content: "收到!这是 mock 模式下的自动回复 — 接入真实网关后会替换为服务端推送。",
    createdAt: now() + 1,
    state: "read",
  };
  mockMessages[sessionId] = [...(mockMessages[sessionId] ?? []), reply];
}

export const isMock = USE_MOCK;

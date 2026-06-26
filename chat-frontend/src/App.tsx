import {
  Check,
  CheckCheck,
  MessageSquare,
  Phone,
  Search,
  Send,
  Settings,
  Smile,
  UserPlus,
  Users,
} from "lucide-react";
import {
  type FormEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {AnimatePresence, motion} from "motion/react";

import {api, isMock} from "./api";
import type {Conversation, FriendApply, Message, User} from "./types";

export function App() {
  const me = useMemo(() => api.me(), []);
  const users = useMemo(() => api.userMap(), []);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [applies, setApplies] = useState<FriendApply[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.conversations().then((c) => {
      setConversations(c);
      setActiveId((id) => id ?? c[0]?.sessionId ?? null);
    });
    api.applies().then(setApplies);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    api.messages(activeId).then((m) => alive && setMessages(m));
    // mark read locally
    setConversations((cs) =>
      cs.map((c) => (c.sessionId === activeId ? {...c, unread: 0} : c)),
    );
    return () => {
      alive = false;
    };
  }, [activeId]);

  const active = conversations.find((c) => c.sessionId === activeId) ?? null;

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  async function handleSend(content: string) {
    if (!activeId) return;
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      sessionId: activeId,
      senderUuid: me.uuid,
      kind: "text",
      content,
      createdAt: Date.now(),
      state: "sending",
    };
    setMessages((m) => [...m, optimistic]);
    bumpConversation(activeId, optimistic);

    const saved = await api.send(activeId, content);
    setMessages((m) =>
      m.map((x) => (x.id === optimistic.id ? saved : x)),
    );
    // pull any bot reply the mock layer appended
    const refreshed = await api.messages(activeId);
    setMessages(refreshed);
    const tail = refreshed[refreshed.length - 1];
    if (tail) bumpConversation(activeId, tail);
  }

  function bumpConversation(sessionId: string, lastMessage: Message) {
    setConversations((cs) => {
      const next = cs.map((c) =>
        c.sessionId === sessionId ? {...c, lastMessage} : c,
      );
      next.sort(
        (a, b) =>
          (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0),
      );
      return next;
    });
  }

  const pendingApplies = applies.filter((a) => a.status === "pending");

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-950 text-slate-100">
      <RailNav pendingCount={pendingApplies.length} />

      <ConversationList
        conversations={filtered}
        activeId={activeId}
        users={users}
        query={query}
        onQuery={setQuery}
        onSelect={setActiveId}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        {active ? (
          <ChatPane
            key={active.sessionId}
            conversation={active}
            messages={messages}
            me={me}
            users={users}
            onSend={handleSend}
          />
        ) : (
          <EmptyState />
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function RailNav({pendingCount}: {pendingCount: number}) {
  const [tab, setTab] = useState("chats");
  const items = [
    {id: "chats", icon: MessageSquare, label: "聊天"},
    {id: "contacts", icon: Users, label: "通讯录", badge: pendingCount},
    {id: "calls", icon: Phone, label: "通话"},
  ];
  return (
    <nav className="flex w-16 flex-col items-center gap-1 border-r border-white/5 bg-slate-900/60 py-4">
      <div className="mb-4 grid size-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 font-bold">
        ∞
      </div>
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => setTab(it.id)}
          title={it.label}
          className={`relative grid size-11 place-items-center rounded-xl transition ${
            tab === it.id
              ? "bg-white/10 text-blue-400"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
          }`}
        >
          <it.icon size={20} />
          {it.badge ? (
            <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4">
              {it.badge}
            </span>
          ) : null}
        </button>
      ))}
      <button
        title="设置"
        className="mt-auto grid size-11 place-items-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
      >
        <Settings size={20} />
      </button>
    </nav>
  );
}

function ConversationList({
  conversations,
  activeId,
  users,
  query,
  onQuery,
  onSelect,
}: {
  conversations: Conversation[];
  activeId: string | null;
  users: Record<string, User>;
  query: string;
  onQuery: (v: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="flex w-80 flex-col border-r border-white/5 bg-slate-900/40">
      <header className="flex items-center justify-between px-4 py-4">
        <h1 className="text-lg font-semibold">消息</h1>
        <button
          title="发起聊天"
          className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-200"
        >
          <UserPlus size={18} />
        </button>
      </header>

      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-xl bg-slate-800/70 px-3 py-2">
          <Search size={16} className="text-slate-500" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="搜索会话"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-slate-500">
            没有匹配的会话
          </p>
        ) : (
          conversations.map((c) => (
            <ConversationRow
              key={c.sessionId}
              conversation={c}
              users={users}
              active={c.sessionId === activeId}
              onClick={() => onSelect(c.sessionId)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function ConversationRow({
  conversation,
  users,
  active,
  onClick,
}: {
  conversation: Conversation;
  users: Record<string, User>;
  active: boolean;
  onClick: () => void;
}) {
  const last = conversation.lastMessage;
  const senderName =
    last && last.senderUuid !== "u-me"
      ? users[last.senderUuid]?.username ?? ""
      : "";
  const preview = last
    ? conversation.kind === "group" && senderName
      ? `${senderName}: ${last.content}`
      : last.content
    : "暂无消息";

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
        active ? "bg-blue-500/15" : "hover:bg-white/5"
      }`}
    >
      <Avatar src={conversation.avatar} alt={conversation.title} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{conversation.title}</span>
          {last && (
            <time className="shrink-0 text-[11px] text-slate-500">
              {formatTime(last.createdAt)}
            </time>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm text-slate-400">{preview}</span>
          {conversation.unread > 0 && (
            <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-blue-500 px-1.5 text-[11px] font-semibold">
              {conversation.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ChatPane({
  conversation,
  messages,
  me,
  users,
  onSend,
}: {
  conversation: Conversation;
  messages: Message[];
  me: User;
  users: Record<string, User>;
  onSend: (content: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <>
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <Avatar src={conversation.avatar} alt={conversation.title} size={38} />
          <div>
            <div className="font-semibold leading-tight">{conversation.title}</div>
            <div className="text-xs text-slate-500">
              {conversation.kind === "group"
                ? `${conversation.memberUuids.length} 位成员`
                : "在线"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <IconBtn icon={Phone} title="语音通话" />
          <IconBtn icon={Search} title="查找聊天记录" />
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-1 overflow-y-auto px-6 py-4"
      >
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              me={me}
              users={users}
              isGroup={conversation.kind === "group"}
              showAvatar={
                m.senderUuid !== messages[i - 1]?.senderUuid ||
                m.kind === "system"
              }
            />
          ))}
        </AnimatePresence>
      </div>

      <Composer onSend={onSend} />
    </>
  );
}

function MessageBubble({
  message,
  me,
  users,
  isGroup,
  showAvatar,
}: {
  message: Message;
  me: User;
  users: Record<string, User>;
  isGroup: boolean;
  showAvatar: boolean;
}) {
  if (message.kind === "system") {
    return (
      <div className="my-2 text-center">
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-500">
          {message.content}
        </span>
      </div>
    );
  }

  const mine = message.senderUuid === me.uuid;
  const sender = users[message.senderUuid];

  return (
    <motion.div
      initial={{opacity: 0, y: 6}}
      animate={{opacity: 1, y: 0}}
      className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}
    >
      <div className="w-9 shrink-0">
        {showAvatar && !mine && (
          <Avatar src={sender?.avatar ?? ""} alt={sender?.username ?? ""} size={36} />
        )}
      </div>
      <div className={`flex max-w-[62%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {isGroup && !mine && showAvatar && (
          <span className="mb-0.5 px-1 text-xs text-slate-500">
            {sender?.username}
          </span>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
            mine
              ? "rounded-br-md bg-blue-600 text-white"
              : "rounded-bl-md bg-slate-800 text-slate-100"
          }`}
        >
          {message.content}
        </div>
        <div className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-slate-500">
          {formatTime(message.createdAt)}
          {mine && <DeliveryTick state={message.state} />}
        </div>
      </div>
    </motion.div>
  );
}

function DeliveryTick({state}: {state: Message["state"]}) {
  if (state === "sending")
    return <span className="size-2 animate-pulse rounded-full bg-slate-500" />;
  if (state === "read") return <CheckCheck size={12} className="text-blue-400" />;
  return <Check size={12} />;
}

function Composer({onSend}: {onSend: (content: string) => void}) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const v = text.trim();
    if (!v) return;
    onSend(v);
    setText("");
    if (taRef.current) taRef.current.style.height = "auto";
  }

  return (
    <form
      onSubmit={submit}
      className="border-t border-white/5 px-4 py-3"
    >
      <div className="flex items-end gap-2 rounded-2xl bg-slate-800/70 px-3 py-2">
        <button
          type="button"
          title="表情"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:text-slate-200"
        >
          <Smile size={20} />
        </button>
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          placeholder="输入消息,Enter 发送 · Shift+Enter 换行"
          className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-600 text-white transition disabled:opacity-40 enabled:hover:bg-blue-500"
        >
          <Send size={18} />
        </button>
      </div>
    </form>
  );
}

function EmptyState() {
  return (
    <div className="grid h-full place-items-center text-center text-slate-500">
      <div>
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-white/5">
          <MessageSquare size={28} />
        </div>
        <p>选择一个会话开始聊天</p>
        {isMock && (
          <p className="mt-2 text-xs text-slate-600">
            当前为 Mock 模式 · 设置 <code>VITE_API_BASE</code> 接入真实网关
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

function Avatar({src, alt, size}: {src: string; alt: string; size: number}) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0 rounded-xl object-cover"
      style={{width: size, height: size}}
    />
  );
}

function IconBtn({
  icon: Icon,
  title,
}: {
  icon: typeof Phone;
  title: string;
}) {
  return (
    <button
      title={title}
      className="grid size-9 place-items-center rounded-lg hover:bg-white/5 hover:text-slate-200"
    >
      <Icon size={18} />
    </button>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

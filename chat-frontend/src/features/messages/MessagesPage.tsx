import {useEffect, useMemo, useRef, useState} from "react";

import {useQueryClient} from "@tanstack/react-query";
import {ArrowLeft, Search, Send, Sparkles} from "lucide-react";
import {NavLink, useNavigate, useParams} from "react-router";

import {
  Avatar,
  Button,
  cn,
  DeliveryTick,
  EmptyState,
  ErrorState,
  ScrollShadow,
  SectionLabel,
  SkeletonList,
  StatusDot,
  UnreadBadge,
} from "@infinitechat/design-system";

import {api} from "@/api";
import {useConversations, useMessages, useSendMessage} from "@/api/queries";
import type {Conversation, Message} from "@/api/types";
import {useUiStore} from "@/store/ui";
import {formatClock, formatRelative} from "@/lib/format";

export function MessagesPage() {
  const {sessionId} = useParams();
  const selected = sessionId ?? undefined;

  return (
    <div className="flex h-full min-w-0">
      <ConversationsColumn
        selectedId={selected}
        className={cn(selected ? "hidden md:flex" : "flex")}
      />
      <ChatColumn
        sessionId={selected}
        className={cn(selected ? "flex" : "hidden md:flex")}
      />
      <AssistantPanel />
    </div>
  );
}

function ConversationsColumn({
  selectedId,
  className,
}: {
  selectedId?: string;
  className?: string;
}) {
  const {data, isLoading, isError, refetch} = useConversations();
  const [query, setQuery] = useState("");
  const users = api.userMap();

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((c) => c.title.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <aside
      className={cn(
        "w-full min-w-0 flex-col border-r border-separator md:w-80 md:shrink-0",
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <SectionLabel>会话</SectionLabel>
      </div>
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-[var(--lx-radius-row)] border border-separator bg-surface px-3 py-2 focus-within:border-[color-mix(in_oklch,var(--lx-accent)_50%,var(--separator))]">
          <Search className="size-4 text-muted" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索会话"
            aria-label="搜索会话"
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </div>
      </div>

      <ScrollShadow hideScrollBar className="min-h-0 flex-1 px-2 pb-3">
        {isLoading ? (
          <SkeletonList rows={6} />
        ) : isError ? (
          <ErrorState compact onRetry={() => refetch()} />
        ) : list.length === 0 ? (
          <EmptyState title="还没有会话" description="从通讯录发起一段对话,或在发现里认识新朋友。" />
        ) : (
          list.map((c) => (
            <ConversationRow key={c.id} conv={c} users={users} active={c.id === selectedId} />
          ))
        )}
      </ScrollShadow>
    </aside>
  );
}

function ConversationRow({
  conv,
  users,
  active,
}: {
  conv: Conversation;
  users: Record<string, {name: string; avatar?: string; presence?: "online" | "offline" | "away"}>;
  active: boolean;
}) {
  const last = conv.lastMessage;
  const other = conv.kind === "single" ? users[conv.memberIds.find((m) => m !== "u-me") ?? ""] : undefined;
  const preview = last
    ? conv.kind === "group" && last.senderId !== "u-me"
      ? `${users[last.senderId]?.name ?? ""}: ${last.content}`
      : last.content
    : "暂无消息";

  return (
    <NavLink
      to={`/messages/${conv.id}`}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
        active
          ? "bg-surface shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_8%,transparent)]"
          : "hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)]",
      )}
    >
      <Avatar name={conv.title} size="lg" presence={other?.presence} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{conv.title}</span>
          {conv.lastMessageTime ? (
            <time className="shrink-0 text-[0.6875rem] tabular-nums text-muted">
              {formatRelative(conv.lastMessageTime)}
            </time>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-[0.8125rem] text-muted">{preview}</span>
          <UnreadBadge count={conv.unreadCount} />
        </div>
      </div>
    </NavLink>
  );
}

function ChatColumn({sessionId, className}: {sessionId?: string; className?: string}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const convos = useConversations();
  const users = api.userMap();
  const me = api.me();
  const conv = convos.data?.find((c) => c.id === sessionId);

  const {data, isLoading, isError, refetch} = useMessages(sessionId);
  const send = useSendMessage(sessionId ?? "");

  const draft = useUiStore((s) => (sessionId ? (s.drafts[sessionId] ?? "") : ""));
  const setDraft = useUiStore((s) => s.setDraft);

  const scrollRef = useRef<HTMLDivElement>(null);
  const items = data?.items ?? [];

  // Mark read on open (M10).
  useEffect(() => {
    if (!sessionId) return;
    api.markRead(sessionId).then(() => qc.invalidateQueries({queryKey: ["conversations"]}));
  }, [sessionId, qc]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  if (!sessionId) {
    return (
      <section className={cn("min-w-0 flex-1 flex-col", className)}>
        <div className="grid h-full place-items-center">
          <EmptyState
            icon={<Sparkles className="size-5" />}
            title="选择一个会话"
            description="从左侧挑一段对话开始,或问问灵犀。"
          />
        </div>
      </section>
    );
  }

  function submit(text: string) {
    const v = text.trim();
    if (!v || !sessionId) return;
    send.mutate(v);
    setDraft(sessionId, "");
  }

  return (
    <section className={cn("min-w-0 flex-1 flex-col", className)}>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-separator px-4">
        <button
          type="button"
          onClick={() => navigate("/messages")}
          aria-label="返回会话列表"
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-[color-mix(in_oklch,var(--foreground)_7%,transparent)] md:hidden"
        >
          <ArrowLeft className="size-5" />
        </button>
        <Avatar name={conv?.title ?? "会话"} size="md" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{conv?.title ?? "会话"}</div>
          <div className="flex items-center gap-1.5 text-[0.6875rem] text-muted">
            {conv?.kind === "group" ? (
              <span>{conv.memberIds.length} 位成员</span>
            ) : conv?.kind === "assistant" ? (
              <span>灵犀助手</span>
            ) : (
              <>
                <StatusDot state="online" />
                <span>在线</span>
              </>
            )}
          </div>
        </div>
      </header>

      <ScrollShadow ref={scrollRef} hideScrollBar className="min-h-0 flex-1 space-y-1 px-4 py-4">
        {isLoading ? (
          <SkeletonList rows={5} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="开始对话" description="发送第一条消息。" />
        ) : (
          items.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              mine={m.senderId === me.id}
              senderName={users[m.senderId]?.name ?? ""}
              isGroup={conv?.kind === "group"}
              showAvatar={m.senderId !== items[i - 1]?.senderId}
              onRetry={() => submit(m.content)}
            />
          ))
        )}
      </ScrollShadow>

      <Composer
        value={draft}
        onChange={(v) => sessionId && setDraft(sessionId, v)}
        onSubmit={() => submit(draft)}
      />
    </section>
  );
}

function MessageBubble({
  message,
  mine,
  senderName,
  isGroup,
  showAvatar,
  onRetry,
}: {
  message: Message;
  mine: boolean;
  senderName: string;
  isGroup: boolean;
  showAvatar: boolean;
  onRetry: () => void;
}) {
  if (message.kind === "system") {
    return (
      <div className="my-2 text-center">
        <span className="rounded-full bg-surface px-3 py-1 text-[0.6875rem] text-muted">
          {message.content}
        </span>
      </div>
    );
  }
  return (
    <div className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
      <div className="w-8 shrink-0">
        {!mine && showAvatar ? <Avatar name={senderName} size="sm" /> : null}
      </div>
      <div className={cn("flex max-w-[68%] flex-col", mine ? "items-end" : "items-start")}>
        {isGroup && !mine && showAvatar ? (
          <span className="mb-0.5 px-1 text-[0.6875rem] text-muted">{senderName}</span>
        ) : null}
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
            mine
              ? "rounded-br-md bg-[var(--lx-accent)] text-white"
              : "rounded-bl-md bg-surface text-foreground",
          )}
        >
          {message.content}
        </div>
        <div className="mt-0.5 flex items-center gap-1 px-1 text-[0.625rem] text-muted">
          <span className="tabular-nums">{formatClock(message.createdAt)}</span>
          {mine ? <DeliveryTick state={message.delivery} onRetry={onRetry} /> : null}
        </div>
      </div>
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="shrink-0 border-t border-separator p-3">
      <div className="flex items-end gap-2 rounded-2xl border border-separator bg-surface px-3 py-2 focus-within:border-[color-mix(in_oklch,var(--lx-accent)_45%,var(--separator))]">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
              if (ref.current) ref.current.style.height = "auto";
            }
          }}
          placeholder="输入消息,Enter 发送 · Shift+Enter 换行"
          aria-label="消息输入框"
          className="max-h-36 min-h-[1.5rem] flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted"
        />
        <Button
          size="sm"
          iconOnly
          aria-label="发送"
          disabled={!value.trim()}
          onClick={() => {
            onSubmit();
            if (ref.current) ref.current.style.height = "auto";
          }}
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/** Contextual 灵犀 panel — desktop fourth column (DESIGN.md four-column workspace). */
function AssistantPanel() {
  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l border-separator bg-surface xl:flex">
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <Sparkles className="size-4 text-[var(--lx-accent)]" aria-hidden="true" />
        <SectionLabel>灵犀</SectionLabel>
      </div>
      <div className="space-y-2 px-4 py-2">
        <p className="text-[0.8125rem] leading-relaxed text-muted">
          让灵犀帮你梳理当前会话:回顾重点、起草回复、提醒待办。
        </p>
        <div className="space-y-1.5 pt-1">
          {["总结这段对话", "帮我起草一条回复", "提取待办事项"].map((s) => (
            <button
              key={s}
              type="button"
              className="w-full rounded-xl border border-separator bg-background px-3 py-2 text-left text-[0.8125rem] text-foreground transition-colors hover:border-[color-mix(in_oklch,var(--lx-accent)_40%,var(--separator))]"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

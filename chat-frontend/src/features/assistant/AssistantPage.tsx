import {useEffect, useRef, useState} from "react";

import {useQueryClient} from "@tanstack/react-query";
import {Sparkles} from "lucide-react";

import {cn, EmptyState, ErrorState, SkeletonList} from "@infinitechat/design-system";

import {api} from "@/api";
import {useAssistantStream, useMessages} from "@/api/queries";
import {Composer, MessageBubble} from "@/features/messages/parts";

const SESSION = "s-lingxi"; // the assistant lives in the IM as the 灵犀 conversation

const CAPABILITIES = [
  {id: "chat", label: "对话"},
  {id: "summary", label: "总结"},
  {id: "draft", label: "起草"},
  {id: "knowledge", label: "知识"},
];

const SUGGESTIONS: Record<string, string[]> = {
  chat: ["最近有什么我该关注的", "帮我安排今天的回复"],
  summary: ["总结核心开发组的讨论", "回顾我和周明的对话重点"],
  draft: ["给核心开发组起草进度通知", "礼貌地回复一个邀约"],
  knowledge: ["把上周的要点整理成清单", "根据我的资料给个建议"],
};

/**
 * The 灵犀 assistant surface — a real streaming chat on Mock (P2 swaps the mock
 * stream for SSE `/api/agent/chat`, reusing S2's trace/citation components). It
 * shares the `s-lingxi` conversation with the IM, so both stay in sync.
 */
export function AssistantPage() {
  const qc = useQueryClient();
  const me = api.me();
  const users = api.userMap();
  const [cap, setCap] = useState("chat");
  const [draft, setDraft] = useState("");

  const {data, isLoading, isError, refetch} = useMessages(SESSION);
  const assistant = useAssistantStream(SESSION);
  const items = data?.items ?? [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastLen = items[items.length - 1]?.content.length ?? 0;

  useEffect(() => {
    api.markRead(SESSION).then(() => qc.invalidateQueries({queryKey: ["conversations"]}));
  }, [qc]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length, lastLen]);

  function submit(text: string) {
    const v = text.trim();
    if (!v || assistant.streaming) return;
    assistant.send(v);
    setDraft("");
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="mx-auto flex w-full max-w-[760px] items-center gap-3 px-4 pt-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--lx-accent)_14%,var(--surface))]">
          <Sparkles className="size-4 text-[var(--lx-accent)]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold">灵犀</div>
          <div className="text-[0.6875rem] text-muted">懂你的助手</div>
        </div>
        {/* Command strip — content-fit capability tabs (DESIGN.md). */}
        <div className="ml-auto flex flex-wrap justify-end gap-1.5">
          {CAPABILITIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={cap === c.id}
              onClick={() => setCap(c.id)}
              className={cn(
                "rounded-full px-3 py-1 text-[0.8125rem] font-medium transition-colors",
                cap === c.id
                  ? "bg-[var(--lx-accent)] text-white"
                  : "border border-separator bg-surface text-muted hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </header>

      <div
        ref={scrollRef}
        className="mx-auto min-h-0 w-full max-w-[760px] flex-1 space-y-1 overflow-y-auto px-4 py-4"
      >
        {isLoading ? (
          <SkeletonList rows={4} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="size-5" />}
            title="问问灵犀"
            description="梳理消息、起草回复、回顾要点 —— 直接说想做什么。"
          />
        ) : (
          items.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              mine={m.senderId === me.id}
              senderName={users[m.senderId]?.name ?? ""}
              isGroup={false}
              showAvatar={m.senderId !== items[i - 1]?.senderId}
              onRetry={() => submit(m.content)}
            />
          ))
        )}
      </div>

      <div className="mx-auto w-full max-w-[760px] px-4">
        <div className="flex flex-wrap gap-1.5 pb-1">
          {(SUGGESTIONS[cap] ?? []).map((s) => (
            <button
              key={s}
              type="button"
              disabled={assistant.streaming}
              onClick={() => submit(s)}
              className="rounded-full border border-separator bg-surface px-3 py-1 text-[0.75rem] text-muted transition-colors hover:text-foreground disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[760px]">
        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={() => submit(draft)}
          streaming={assistant.streaming}
          onStop={assistant.stop}
          placeholder="想让灵犀做什么?"
        />
      </div>
    </div>
  );
}

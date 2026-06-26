import {useState} from "react";

import {ArrowUp, Sparkles} from "lucide-react";
import {useNavigate} from "react-router";

import {cn, Panel, SectionLabel} from "@infinitechat/design-system";

import {Page} from "@/features/_shared/Page";

const CAPABILITIES = [
  {id: "chat", label: "对话"},
  {id: "summary", label: "总结"},
  {id: "draft", label: "起草"},
  {id: "knowledge", label: "知识"},
];

const SUGGESTIONS: Record<string, string[]> = {
  chat: ["最近有什么我该关注的消息?", "帮我安排一下今天的回复"],
  summary: ["总结核心开发组今天的讨论", "回顾我和周明的对话重点"],
  draft: ["给核心开发组起草一条进度通知", "帮我礼貌地回复一个邀约"],
  knowledge: ["根据我的资料回答:E2E 怎么隔离", "把上周的要点整理成清单"],
};

export function AssistantPage() {
  const navigate = useNavigate();
  const [cap, setCap] = useState("chat");
  const [text, setText] = useState("");

  // For P0 the assistant surface flows into the IM-embedded 灵犀 conversation
  // (assistant-in-IM). P2 wires streaming /api/agent/chat + S2 trace/citation.
  function ask(q?: string) {
    if (q) setText(q);
    navigate("/messages/s-lingxi");
  }

  return (
    <Page eyebrow="灵犀" title="问问灵犀">
      <p className="-mt-2 mb-4 text-sm text-muted">懂你的助手 — 梳理消息、起草回复、回答你的问题。</p>

      {/* Command strip — content-fit capability tabs (DESIGN.md). */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {CAPABILITIES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={cap === c.id}
            onClick={() => setCap(c.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors",
              cap === c.id
                ? "bg-[var(--lx-accent)] text-white"
                : "border border-separator bg-surface text-muted hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <Panel className="p-4">
        <div className="flex items-center gap-2 pb-3">
          <span className="grid size-8 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--lx-accent)_14%,var(--surface))]">
            <Sparkles className="size-4 text-[var(--lx-accent)]" aria-hidden="true" />
          </span>
          <div className="text-sm font-medium">灵犀</div>
        </div>

        {/* Prompt input */}
        <div className="flex items-end gap-2 rounded-2xl border border-separator bg-background px-3 py-2 focus-within:border-[color-mix(in_oklch,var(--lx-accent)_45%,var(--separator))]">
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder="想让灵犀做什么?"
            aria-label="向灵犀提问"
            className="max-h-40 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted"
          />
          <button
            type="button"
            aria-label="发送给灵犀"
            onClick={() => ask()}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--lx-accent)] text-white transition-colors hover:bg-[var(--lx-accent-strong)]"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>

        <div className="pt-3">
          <SectionLabel>试试</SectionLabel>
          <div className="mt-2 flex flex-col gap-1.5">
            {(SUGGESTIONS[cap] ?? []).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="rounded-xl border border-separator bg-background px-3 py-2 text-left text-[0.8125rem] text-foreground transition-colors hover:border-[color-mix(in_oklch,var(--lx-accent)_40%,var(--separator))]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Panel>
    </Page>
  );
}

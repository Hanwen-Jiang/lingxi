import {ArrowRight, MessageSquare, Sparkles} from "lucide-react";
import {useNavigate} from "react-router";

import {Button, DividerRow, Panel, SectionLabel, UnreadBadge} from "@infinitechat/design-system";

import {useApplies, useConversations} from "@/api/queries";
import {Page} from "@/features/_shared/Page";

const STEPS = [
  {n: 1, title: "回到消息", desc: "查看未读,继续上次的对话。"},
  {n: 2, title: "问问灵犀", desc: "让助手总结会话、起草回复。"},
  {n: 3, title: "整理通讯录", desc: "通过好友申请,发起新的对话。"},
];

export function HomePage() {
  const navigate = useNavigate();
  const convos = useConversations();
  const applies = useApplies();
  const unread = (convos.data ?? []).reduce((n, c) => n + c.unreadCount, 0);
  const pending = (applies.data ?? []).filter((a) => a.status === "pending").length;

  return (
    <Page eyebrow="灵犀" title="晚上好">
      <p className="-mt-2 mb-5 text-sm text-muted">懂你的,不只是消息。</p>

      <div className="mb-5 flex flex-wrap gap-2">
        <Button onClick={() => navigate("/messages")}>
          <MessageSquare className="size-4" />
          打开消息
        </Button>
        <Button variant="secondary" onClick={() => navigate("/assistant")}>
          <Sparkles className="size-4" />
          问问灵犀
        </Button>
      </div>

      {/* Insight rail — open divider rows, not four stacked mini cards (DESIGN.md). */}
      <Panel className="mb-5">
        <div className="px-4 pb-1 pt-3">
          <SectionLabel>今日概览</SectionLabel>
        </div>
        <DividerRow>
          <span className="flex-1 text-sm">未读消息</span>
          {unread > 0 ? <UnreadBadge count={unread} /> : <span className="text-sm text-muted">0</span>}
        </DividerRow>
        <DividerRow>
          <span className="flex-1 text-sm">好友申请</span>
          <span className="text-sm tabular-nums text-foreground">{pending}</span>
        </DividerRow>
        <DividerRow last>
          <span className="flex-1 text-sm">灵犀待办</span>
          <span className="text-sm text-muted">暂无</span>
        </DividerRow>
      </Panel>

      {/* Workflow — open divider strip with numbered blue dots (DESIGN.md). */}
      <Panel>
        <div className="px-4 pb-1 pt-3">
          <SectionLabel>快速开始</SectionLabel>
        </div>
        {STEPS.map((s, i) => (
          <DividerRow key={s.n} last={i === STEPS.length - 1}>
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklch,var(--lx-accent)_14%,transparent)] text-[0.75rem] font-semibold text-[var(--lx-accent)]">
              {s.n}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{s.title}</div>
              <div className="truncate text-[0.8125rem] text-muted">{s.desc}</div>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
          </DividerRow>
        ))}
      </Panel>
    </Page>
  );
}

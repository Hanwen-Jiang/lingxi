import {DividerRow, Panel, SectionLabel, StatusPill} from "@infinitechat/design-system";

import {Page} from "@/features/_shared/Page";

const SCENARIOS = [
  {n: 1, title: "用灵犀整理一周消息", tag: "效率", desc: "让助手把散落的对话归纳成重点清单。"},
  {n: 2, title: "给群聊起草一条通知", tag: "协作", desc: "描述意图,灵犀给出可直接发送的措辞。"},
  {n: 3, title: "把收藏的内容问成答案", tag: "知识", desc: "结合你的资料,得到带出处的回答。"},
];

export function DiscoverPage() {
  return (
    <Page eyebrow="发现" title="可以这样用灵犀" aside={<RecommendPanel />}>
      <Panel>
        <div className="px-4 pb-1 pt-3">
          <SectionLabel>精选场景</SectionLabel>
        </div>
        {SCENARIOS.map((s, i) => (
          <DividerRow key={s.n} last={i === SCENARIOS.length - 1}>
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-separator text-[0.75rem] font-semibold tabular-nums text-muted">
              {s.n}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{s.title}</span>
                <StatusPill label={s.tag} className="shrink-0" />
              </div>
              <div className="truncate text-[0.8125rem] text-muted">{s.desc}</div>
            </div>
          </DividerRow>
        ))}
      </Panel>
    </Page>
  );
}

function RecommendPanel() {
  return (
    <Panel>
      <div className="px-4 pb-1 pt-3">
        <SectionLabel>本周推荐</SectionLabel>
      </div>
      <div className="space-y-3 px-4 py-3">
        <p className="text-[0.8125rem] leading-relaxed text-muted">
          先从一个真实场景开始,灵犀会在发送前给你预览,重要内容不丢失。
        </p>
        <div className="h-1 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]">
          <div className="h-full w-1/3 rounded-full bg-[var(--lx-accent)]" />
        </div>
        <div className="flex items-center justify-between text-[0.75rem] text-muted">
          <span>预计 3 分钟</span>
          <span>发送前确认</span>
        </div>
      </div>
    </Panel>
  );
}

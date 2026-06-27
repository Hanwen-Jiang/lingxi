import {HeartPulse, MessageSquare, RefreshCw} from "lucide-react";

import {Button} from "@heroui/react/button";
import {ScrollShadow} from "@heroui/react/scroll-shadow";

import {EmptyState} from "@infinitechat/design-system";

import {PanelTitle} from "../../components/ui/primitives";
import type {ChatSessionSummary, ChatTurnSummary, ModelStatusResponse} from "../../types";

// User-facing turn status labels — keep them calm and zh-CN, never raw enum
// values (which leak internal state per D10/D12).
function turnStatusLabel(status?: string) {
  switch (status) {
    case "SUCCESS":
    case "complete":
      return "已完成";
    case "ERROR":
    case "error":
      return "出错了";
    case "streaming":
      return "回复中";
    case "submitted":
      return "已发送";
    default:
      return "进行中";
  }
}

export function SessionInsightPanel({
  modelStatus,
  session,
  turns,
  onSummarize,
}: {
  modelStatus: ModelStatusResponse | null;
  session: ChatSessionSummary | null;
  turns: ChatTurnSummary[];
  onSummarize: () => void;
}) {
  return (
    <aside className="hidden min-h-0 min-w-0 border-l border-separator bg-surface-secondary/60 xl:flex xl:flex-col">
      <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-separator px-4">
        <div>
          <div className="text-sm font-semibold">本次对话</div>
          <div className="text-xs text-muted">
            {modelStatus?.configured ? "灵犀会为你做总结" : "暂时只能做简要总结"}
          </div>
        </div>
        <Button className="control-button" size="sm" variant="outline" onPress={onSummarize}>
          <RefreshCw className="size-4" />
          刷新
        </Button>
      </div>
      <ScrollShadow className="min-h-0 flex-1 overflow-y-auto p-4" hideScrollBar>
        <div className="space-y-5">
          <section className="panel-section">
            <PanelTitle icon={<HeartPulse className="size-4" />} title="对话总结" />
            <p className="text-sm leading-6 text-muted">
              {session?.summary || "还没有总结。先和灵犀聊聊,这里会自动生成。"}
            </p>
          </section>
          <section className="space-y-3">
            <PanelTitle icon={<MessageSquare className="size-4" />} title="逐轮回顾" />
            {turns.length === 0 ? (
              <EmptyState title="还没有内容" description="开始一段对话,这里会逐轮记录。" />
            ) : (
              turns.map((turn, index) => (
                <div key={turn.id} className="rounded-2xl bg-surface p-3 shadow-surface">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">第 {index + 1} 轮</span>
                    <span className="text-xs text-muted">{turnStatusLabel(turn.status)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">{turn.miniSummary}</p>
                </div>
              ))
            )}
          </section>
        </div>
      </ScrollShadow>
    </aside>
  );
}

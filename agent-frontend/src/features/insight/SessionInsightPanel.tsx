import {HeartPulse, MessageSquare, RefreshCw} from "lucide-react";

import {Button} from "@heroui/react/button";
import {Chip} from "@heroui/react/chip";
import {ScrollShadow} from "@heroui/react/scroll-shadow";

import {PanelTitle} from "../../components/ui/primitives";
import {statusTone} from "../../lib/chat";
import type {ChatSessionSummary, ChatTurnSummary, ModelStatusResponse} from "../../types";

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
          <div className="text-sm font-semibold">Session Insight</div>
          <div className="text-xs text-muted">
            {modelStatus?.configured ? "Model summaries available" : "Deterministic summaries"}
          </div>
        </div>
        <Button className="control-button" size="sm" variant="outline" onPress={onSummarize}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>
      <ScrollShadow className="min-h-0 flex-1 overflow-y-auto p-4" hideScrollBar>
        <div className="space-y-5">
          <section className="panel-section">
            <PanelTitle icon={<HeartPulse className="size-4" />} title="Session Summary" />
            <p className="text-sm leading-6 text-muted">
              {session?.summary || "No summary yet. Send a message to create one."}
            </p>
          </section>
          <section className="space-y-3">
            <PanelTitle icon={<MessageSquare className="size-4" />} title="Turn Summaries" />
            {turns.length === 0 ? (
              <p className="rounded-2xl bg-surface p-3 text-sm text-muted shadow-surface">
                No turns recorded for this session yet.
              </p>
            ) : (
              turns.map((turn, index) => (
                <div key={turn.id} className="rounded-2xl bg-surface p-3 shadow-surface">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">Turn {index + 1}</span>
                    <Chip color={statusTone(turn.status)} size="sm" variant="soft">
                      {turn.status}
                    </Chip>
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

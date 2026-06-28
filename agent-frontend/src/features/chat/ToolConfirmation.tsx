import {ShieldCheck} from "lucide-react";

// Use the HeroUI OSS Button directly (as the composer/auth screens do) rather
// than the design-system wrapper — the wrapper is aliased to source and pulls a
// second React copy under vitest, which the react-aria button cannot tolerate.
import {Button} from "@heroui/react/button";

import type {PendingTool} from "../../types";

// M4 (F01) — the agent is holding this turn for human approval of high-risk
// tool calls. Approval rides on the server-issued challengeToken stored in
// useChat (fingerprinted on prompt+session+confirmedToolSet); this card is
// just the user-facing decision point. The tool list is informational — we
// don't ask "which ones to allow" because F01 ignores client-supplied tool
// names; the user either releases the held turn or cancels it.
export function ToolConfirmation({
  tools,
  isConfirming,
  onConfirm,
  onCancel,
}: {
  tools: PendingTool[];
  isConfirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="tool-confirmation rounded-2xl border border-warning/40 bg-warning/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <ShieldCheck className="size-4 shrink-0 text-warning" />
        <span>灵犀想调用以下工具,确认后继续</span>
      </div>
      {tools.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {tools.map((tool) => (
            <li key={tool.name} className="flex items-start gap-3 rounded-xl bg-background/60 px-3 py-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-foreground">{tool.title ?? tool.name}</span>
                {tool.description ? <span className="text-xs text-muted">{tool.description}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button isDisabled={isConfirming} size="sm" variant="outline" onPress={onCancel}>
          取消
        </Button>
        <Button isDisabled={isConfirming} size="sm" onPress={onConfirm}>
          {isConfirming ? "执行中…" : "确认并继续"}
        </Button>
      </div>
    </div>
  );
}

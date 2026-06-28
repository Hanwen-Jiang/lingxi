import {useMemo, useState} from "react";
import {ShieldCheck} from "lucide-react";

// Use the HeroUI OSS Button directly (as the composer/auth screens do) rather
// than the design-system wrapper — the wrapper is aliased to source and pulls a
// second React copy under vitest, which the react-aria button cannot tolerate.
import {Button} from "@heroui/react/button";

import type {PendingTool} from "../../types";

// M4 — when the agent holds tools for human approval, this card lets the user
// pick the subset to allow and resends the turn with confirmedTools[]. It is a
// shell over S1's not-yet-shipped F01 (challenge token): the parsing seam lives
// in lib/chat.extractPendingTools and the resend in useChat.confirmTools, so
// only those change when F01 lands. Local state here is just the checkbox
// selection; it carries no security weight on its own.
export function ToolConfirmation({
  tools,
  isConfirming,
  onConfirm,
}: {
  tools: PendingTool[];
  isConfirming: boolean;
  onConfirm: (selected: string[]) => void;
}) {
  // Default to every tool approved — the common case is "yes, go ahead"; the
  // user unchecks the ones they want to withhold.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(tools.map((tool) => tool.name)));

  const selectedList = useMemo(
    () => tools.filter((tool) => selected.has(tool.name)).map((tool) => tool.name),
    [selected, tools],
  );

  const toggle = (name: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="tool-confirmation rounded-2xl border border-warning/40 bg-warning/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <ShieldCheck className="size-4 shrink-0 text-warning" />
        <span>灵犀想调用以下工具,确认后继续</span>
      </div>
      <ul className="flex flex-col gap-2">
        {tools.map((tool) => {
          const id = `confirm-tool-${tool.name}`;
          return (
            <li key={tool.name}>
              <label
                className="flex cursor-pointer items-start gap-3 rounded-xl bg-background/60 px-3 py-2"
                htmlFor={id}
              >
                <input
                  checked={selected.has(tool.name)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                  disabled={isConfirming}
                  id={id}
                  type="checkbox"
                  onChange={() => toggle(tool.name)}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-foreground">{tool.title ?? tool.name}</span>
                  {tool.description ? <span className="text-xs text-muted">{tool.description}</span> : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button isDisabled={isConfirming} size="sm" variant="outline" onPress={() => onConfirm([])}>
          全部跳过
        </Button>
        <Button isDisabled={isConfirming} size="sm" onPress={() => onConfirm(selectedList)}>
          {isConfirming ? "执行中…" : `确认并继续${selectedList.length ? ` (${selectedList.length})` : ""}`}
        </Button>
      </div>
    </div>
  );
}

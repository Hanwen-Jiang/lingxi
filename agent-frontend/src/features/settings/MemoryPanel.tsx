import {useState} from "react";
import {Brain} from "lucide-react";

import {Button} from "@heroui/react/button";
import {ListBox} from "@heroui/react/list-box";
import {Select} from "@heroui/react/select";

import {PanelTitle, Field} from "../../components/ui/primitives";
import type {ApiClient} from "../../api";
import {MEMORY_TYPES, MEMORY_TYPE_LABELS} from "../../lib/constants";
import type {MemoryItem, MemoryType} from "../../types";

// User-facing memory status labels — the enum strings are wire values, we
// translate at the UI edge so D10/D12 (no internal terms) holds.
function memoryStatusLabel(status?: string) {
  switch (status) {
    case "ACTIVE":
      return "生效中";
    case "DISABLED":
      return "已停用";
    case "SUPERSEDED":
      return "已被纠正";
    default:
      return "生效中";
  }
}

export function MemoryPanel({
  api,
  items,
  sessionId,
  userId,
  onItems,
  onRefresh,
}: {
  api: ApiClient;
  items: MemoryItem[];
  sessionId: string;
  userId: string;
  onItems: (items: MemoryItem[]) => void;
  onRefresh: () => void;
}) {
  const [memoryType, setMemoryType] = useState<MemoryType>("IMPORTANT_FACT");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function writeMemory() {
    if (!content.trim()) return;
    setStatus("正在写入…");
    try {
      await api.writeMemory({
        userId,
        sessionId,
        memoryType,
        content,
        summary,
        confidence: 0.9,
        source: "frontend_workspace",
      });
      const freshItems = await api.listUserMemories(userId, 20);
      onItems(freshItems);
      setContent("");
      setSummary("");
      setStatus("已记下,灵犀会记住。");
    } catch {
      setStatus("写入失败,请重试。");
    }
  }

  return (
    <section className="space-y-5 xl:col-span-2">
      <PanelTitle icon={<Brain className="size-4" />} title="记忆" />
      <div className="panel-section">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted">类型</span>
          <Select
            aria-label="记忆类型"
            fullWidth
            value={memoryType}
            onChange={(value) => {
              if (typeof value === "string") setMemoryType(value as MemoryType);
            }}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {MEMORY_TYPES.map((type) => (
                  <ListBox.Item key={type} id={type} textValue={MEMORY_TYPE_LABELS[type]}>
                    {MEMORY_TYPE_LABELS[type]}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <Field label="内容">
          <textarea
            className="field-input min-h-24 resize-y"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </Field>
        <Field label="摘要">
          <input className="field-input" value={summary} onChange={(event) => setSummary(event.target.value)} />
        </Field>
        <div className="settings-action-row">
          <Button className="settings-action-button" isDisabled={!content.trim()} onPress={() => void writeMemory()}>
            记下
          </Button>
          <Button className="settings-action-button" variant="outline" onPress={onRefresh}>
            刷新
          </Button>
        </div>
      </div>
      {status ? <div className="rounded-2xl bg-surface p-3 text-sm text-muted shadow-surface">{status}</div> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {items.length === 0 ? (
          <p className="rounded-2xl bg-surface p-3 text-sm text-muted shadow-surface">
            还没有记忆。点"记下"或刷新看看。
          </p>
        ) : (
          items.map((item) => (
            <div key={item.memoryId} className="rounded-2xl bg-surface p-3 shadow-surface">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {item.memoryType ? (MEMORY_TYPE_LABELS[item.memoryType as MemoryType] ?? "记忆") : "记忆"}
                </span>
                <span className="rounded-full bg-surface-secondary px-2 py-1 text-xs text-muted">
                  {memoryStatusLabel(item.status)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground">{item.summary || item.content}</p>
              {item.content && item.summary ? (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{item.content}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

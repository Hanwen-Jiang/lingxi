import {useState} from "react";
import {Brain} from "lucide-react";

import {Button} from "@heroui/react/button";
import {Label} from "@heroui/react/label";
import {NativeSelect} from "@heroui-pro/react/native-select";

import {PanelTitle, Field} from "../../components/ui/primitives";
import type {ApiClient} from "../../api";
import {getErrorMessage} from "../../lib/chat";
import {MEMORY_TYPES} from "../../lib/constants";
import type {MemoryItem, MemoryType} from "../../types";

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
  sessionId: number;
  userId: number;
  onItems: (items: MemoryItem[]) => void;
  onRefresh: () => void;
}) {
  const [memoryType, setMemoryType] = useState<MemoryType>("IMPORTANT_FACT");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function writeMemory() {
    if (!content.trim()) return;
    setStatus("Writing memory");
    try {
      await api.writeMemory({userId, sessionId, memoryType, content, summary, confidence: 0.9, source: "frontend_workspace"});
      const freshItems = await api.listUserMemories(userId, 20);
      onItems(freshItems);
      setContent("");
      setSummary("");
      setStatus("Memory written");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  return (
    <section className="space-y-5 xl:col-span-2">
      <PanelTitle icon={<Brain className="size-4" />} title="Memory" />
      <div className="panel-section">
        <NativeSelect fullWidth>
          <Label>Type</Label>
          <NativeSelect.Trigger name="memoryType" value={memoryType} onChange={(event) => setMemoryType(event.target.value as MemoryType)}>
            {MEMORY_TYPES.map((type) => (
              <NativeSelect.Option key={type} value={type}>
                {type}
              </NativeSelect.Option>
            ))}
            <NativeSelect.Indicator />
          </NativeSelect.Trigger>
        </NativeSelect>
        <Field label="Content">
          <textarea className="field-input min-h-24 resize-y" value={content} onChange={(event) => setContent(event.target.value)} />
        </Field>
        <Field label="Summary">
          <input className="field-input" value={summary} onChange={(event) => setSummary(event.target.value)} />
        </Field>
        <div className="settings-action-row">
          <Button className="settings-action-button" isDisabled={!content.trim()} onPress={() => void writeMemory()}>
            Write
          </Button>
          <Button className="settings-action-button" variant="outline" onPress={onRefresh}>
            Refresh
          </Button>
        </div>
      </div>
      {status ? <div className="rounded-2xl bg-surface p-3 text-sm text-muted shadow-surface">{status}</div> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {items.length === 0 ? (
          <p className="rounded-2xl bg-surface p-3 text-sm text-muted shadow-surface">No memories loaded for this user. Use Refresh or write a memory.</p>
        ) : (
          items.map((item) => (
            <div key={item.memoryId} className="rounded-2xl bg-surface p-3 shadow-surface">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{item.memoryType ?? "Memory"}</span>
                <span className="rounded-full bg-surface-secondary px-2 py-1 text-xs text-muted">{item.status ?? "ACTIVE"}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground">{item.summary || item.content}</p>
              {item.content && item.summary ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{item.content}</p> : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

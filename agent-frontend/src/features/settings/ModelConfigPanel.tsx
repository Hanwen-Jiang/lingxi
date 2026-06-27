import {useEffect, useState} from "react";
import {Gauge} from "lucide-react";

import {Button} from "@heroui/react/button";
import {ListBox} from "@heroui/react/list-box";
import {Select} from "@heroui/react/select";

import {PanelTitle, Field} from "../../components/ui/primitives";
import type {ApiClient} from "../../api";
import {REASONING_EFFORTS} from "../../lib/constants";
import {normalizeReasoningEffort} from "../../lib/model";
import type {ModelStatusResponse, ReasoningEffort} from "../../types";

export function ModelConfigPanel({
  api,
  modelStatus,
  onModelStatus,
}: {
  api: ApiClient;
  modelStatus: ModelStatusResponse | null;
  onModelStatus: (status: ModelStatusResponse) => void;
}) {
  const [provider, setProvider] = useState(modelStatus?.provider ?? "openai-compatible");
  const [baseUrl, setBaseUrl] = useState(modelStatus?.baseUrl ?? "https://api.openai.com");
  const [model, setModel] = useState(modelStatus?.model ?? "gpt-5.4-mini");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(String(modelStatus?.temperature ?? 0.7));
  const [maxOutputTokens, setMaxOutputTokens] = useState(String(modelStatus?.maxOutputTokens ?? 1024));
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    normalizeReasoningEffort(modelStatus?.reasoningEffort),
  );
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!modelStatus) return;
    setProvider(modelStatus.provider ?? "openai-compatible");
    setBaseUrl(modelStatus.baseUrl ?? "https://api.openai.com");
    setModel(modelStatus.model ?? "gpt-5.4-mini");
    setTemperature(String(modelStatus.temperature ?? 0.7));
    setMaxOutputTokens(String(modelStatus.maxOutputTokens ?? 1024));
    setReasoningEffort(normalizeReasoningEffort(modelStatus.reasoningEffort));
  }, [modelStatus]);

  async function saveModelConfig() {
    setStatus("正在保存…");
    try {
      const nextStatus = await api.updateModelConfig({
        provider,
        baseUrl,
        apiKey: apiKey.trim() || undefined,
        model,
        temperature: Number(temperature),
        maxOutputTokens: Number(maxOutputTokens),
        reasoningEffort: provider === "openai-compatible" ? reasoningEffort : undefined,
      });
      onModelStatus(nextStatus);
      setApiKey("");
      setStatus(nextStatus.configured ? "已保存。" : (nextStatus.message ?? "已保存。"));
    } catch {
      // Don't leak raw backend error strings into the UI (D10/D12).
      setStatus("保存失败,请重试。");
    }
  }

  return (
    <div className="panel-section">
      <PanelTitle icon={<Gauge className="size-4" />} title="模型配置" />
      <p className="text-sm leading-6 text-muted">
        修改后会立即生效,新对话会使用新设置。API key 仅会发送给后端,不会回显。
      </p>
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted">供应商</span>
        <Select
          aria-label="供应商"
          fullWidth
          value={provider}
          onChange={(value) => {
            if (typeof value === "string") setProvider(value);
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="openai-compatible" textValue="OpenAI 兼容">
                OpenAI 兼容
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="dashscope" textValue="DashScope">
                DashScope
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
      <Field label="Base URL">
        <input className="field-input" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
      </Field>
      <Field label="模型">
        <input className="field-input" value={model} onChange={(event) => setModel(event.target.value)} />
      </Field>
      {provider === "openai-compatible" ? (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted">推理强度</span>
          <Select
            aria-label="推理强度"
            fullWidth
            value={reasoningEffort}
            onChange={(value) => {
              if (typeof value === "string") setReasoningEffort(value as ReasoningEffort);
            }}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {REASONING_EFFORTS.map((effort) => (
                  <ListBox.Item key={effort.value} id={effort.value} textValue={effort.label}>
                    {effort.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      ) : null}
      <Field label="API key">
        <input
          className="field-input"
          placeholder={modelStatus?.configured ? "留空保留当前 key" : "粘贴 API key"}
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="温度">
          <input
            className="field-input"
            step="0.1"
            type="number"
            value={temperature}
            onChange={(event) => setTemperature(event.target.value)}
          />
        </Field>
        <Field label="最大输出 tokens">
          <input
            className="field-input"
            min={1}
            type="number"
            value={maxOutputTokens}
            onChange={(event) => setMaxOutputTokens(event.target.value)}
          />
        </Field>
      </div>
      <Button
        className="control-button settings-action-button"
        variant="outline"
        onPress={() => void saveModelConfig()}
      >
        保存
      </Button>
      {status ? <p className="text-sm leading-6 text-muted">{status}</p> : null}
    </div>
  );
}

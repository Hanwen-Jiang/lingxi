import {useEffect, useState} from "react";
import {Gauge} from "lucide-react";

import {Button} from "@heroui/react/button";
import {NativeSelect} from "@heroui-pro/react/native-select";

import {PanelTitle, Field} from "../../components/ui/primitives";
import type {ApiClient} from "../../api";
import {getErrorMessage} from "../../lib/chat";
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
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(normalizeReasoningEffort(modelStatus?.reasoningEffort));
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
    setStatus("Saving model configuration");
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
      setStatus(nextStatus.configured ? "Model configuration saved" : nextStatus.message ?? "Model configuration saved");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  return (
    <div className="panel-section">
      <PanelTitle icon={<Gauge className="size-4" />} title="Model Configuration" />
      <p className="text-sm leading-6 text-muted">
        Runtime changes apply to new chat, agent, and RAG requests. API keys are accepted by the backend and never echoed back.
      </p>
      <Field label="Provider">
        <NativeSelect fullWidth>
          <NativeSelect.Trigger name="modelProvider" value={provider} onChange={(event) => setProvider(event.target.value)}>
            <NativeSelect.Option value="openai-compatible">OpenAI compatible</NativeSelect.Option>
            <NativeSelect.Option value="dashscope">DashScope</NativeSelect.Option>
            <NativeSelect.Indicator />
          </NativeSelect.Trigger>
        </NativeSelect>
      </Field>
      <Field label="Base URL">
        <input className="field-input" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
      </Field>
      <Field label="Model">
        <input className="field-input" value={model} onChange={(event) => setModel(event.target.value)} />
      </Field>
      {provider === "openai-compatible" ? (
        <Field label="Reasoning effort">
          <NativeSelect fullWidth>
            <NativeSelect.Trigger
              name="modelReasoningEffort"
              value={reasoningEffort}
              onChange={(event) => setReasoningEffort(event.target.value as ReasoningEffort)}
            >
              {REASONING_EFFORTS.map((effort) => (
                <NativeSelect.Option key={effort.value} value={effort.value}>
                  {effort.label}
                </NativeSelect.Option>
              ))}
              <NativeSelect.Indicator />
            </NativeSelect.Trigger>
          </NativeSelect>
        </Field>
      ) : null}
      <Field label="API key">
        <input
          className="field-input"
          placeholder={modelStatus?.configured ? "Leave blank to keep current key" : "Paste API key"}
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Temperature">
          <input className="field-input" step="0.1" type="number" value={temperature} onChange={(event) => setTemperature(event.target.value)} />
        </Field>
        <Field label="Max tokens">
          <input
            className="field-input"
            min={1}
            type="number"
            value={maxOutputTokens}
            onChange={(event) => setMaxOutputTokens(event.target.value)}
          />
        </Field>
      </div>
      <Button className="control-button settings-action-button" variant="outline" onPress={() => void saveModelConfig()}>
        Save Model
      </Button>
      {status ? <p className="text-sm leading-6 text-muted">{status}</p> : null}
    </div>
  );
}

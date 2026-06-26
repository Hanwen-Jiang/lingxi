import {useCallback, useEffect, useMemo, useState} from "react";
import {ArrowUp, Mic, Monitor, Plus, RefreshCw, Route, X} from "lucide-react";

import {Button} from "@heroui/react/button";
import {ProgressCircle} from "@heroui/react/progress-circle";
import {ChatAttachment, ChatAttachmentGroup, ChatAttachmentInput, inferChatAttachmentMediaType} from "@heroui-pro/react/chat-attachment";
import {PromptInput} from "@heroui-pro/react/prompt-input";

import type {ApiClient} from "../../api";
import {getErrorMessage, routeLabel} from "../../lib/chat";
import {COMPOSER_BUTTON_STYLE} from "../../lib/constants";
import {formatFileSize, makeId} from "../../lib/format";
import {
  composerModelFromOption,
  inferProviderLabel,
  modelOptionsWithCurrent,
  normalizeReasoningEffort,
  supportsOpenAiProtocol,
} from "../../lib/model";
import type {AutoChatResponse, ChatStatus, DocumentIngestJobResponse, ModelOption, ModelStatusResponse, ReasoningEffort} from "../../types";

import {ComposerActionsPopover} from "./ComposerActionsPopover";
import {ModelSelectControl} from "./ModelPicker";
import {MobileModelSheet} from "./ModelPickerMobile";

type ComposerAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType?: string;
  src?: string;
  status?: "uploading" | "ready" | "error";
  message?: string;
  jobId?: string;
};

export function ComposerDock({
  api,
  lastRouteResult,
  modelStatus,
  prompt,
  status,
  onJob,
  onModelStatus,
  onPromptChange,
  onSend,
  onStop,
}: {
  api: ApiClient;
  lastRouteResult: AutoChatResponse | null;
  modelStatus: ModelStatusResponse | null;
  prompt: string;
  status: ChatStatus;
  onJob: (job: DocumentIngestJobResponse) => void;
  onModelStatus: (status: ModelStatusResponse) => void;
  onPromptChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
}) {
  const currentModel = modelStatus?.model?.trim() ?? "";
  const reasoningEffort = normalizeReasoningEffort(modelStatus?.reasoningEffort);
  const openAiProtocol = supportsOpenAiProtocol(modelStatus);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modelsStatus, setModelsStatus] = useState<string | null>(null);
  const [tuningStatus, setTuningStatus] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const availableOptions = useMemo(() => modelOptionsWithCurrent(modelOptions, currentModel), [currentModel, modelOptions]);
  const availableModels = useMemo(
    () => availableOptions.map((option) => composerModelFromOption(option, modelStatus, reasoningEffort)),
    [availableOptions, modelStatus, reasoningEffort],
  );
  const selectedModel = availableModels.find((model) => model.id === currentModel) ?? availableModels[0];
  const hasValue = prompt.trim().length > 0;
  const isRunning = status === "submitted" || status === "streaming";
  const route = lastRouteResult ? routeLabel(lastRouteResult.route) : "Auto";
  const routeMeta = lastRouteResult ? `${route}${lastRouteResult.forced ? " · forced" : ""}` : "Direct when simple";
  const progressValue = status === "streaming" ? 64 : status === "submitted" ? 32 : status === "error" ? 100 : 0;
  const statusText = status === "streaming" ? "Streaming" : status === "submitted" ? "Submitted" : status === "error" ? "Error" : "Ready";

  const refreshModels = useCallback(async () => {
    if (!openAiProtocol) {
      setModelOptions([]);
      setModelsStatus("Model listing is available for OpenAI-compatible providers.");
      return;
    }
    setIsLoadingModels(true);
    try {
      const response = await api.listModels();
      setModelOptions(response.models ?? []);
      setModelsStatus(response.message ?? (response.source === "upstream" ? "Loaded models from upstream." : "Using configured model."));
    } catch (error) {
      setModelsStatus(getErrorMessage(error));
    } finally {
      setIsLoadingModels(false);
    }
  }, [api, openAiProtocol]);

  useEffect(() => {
    if (modelStatus?.configured && openAiProtocol) {
      void refreshModels();
      return;
    }
    setModelOptions([]);
  }, [modelStatus?.baseUrl, modelStatus?.configured, modelStatus?.provider, openAiProtocol, refreshModels]);

  useEffect(
    () => () => {
      attachments.forEach((attachment) => {
        if (attachment.src?.startsWith("blob:")) URL.revokeObjectURL(attachment.src);
      });
    },
    [attachments],
  );

  const saveTuning = useCallback(
    async ({model, reasoning}: {model?: string; reasoning?: ReasoningEffort}) => {
      const nextModel = model?.trim() || currentModel;
      const nextReasoning = normalizeReasoningEffort(reasoning ?? reasoningEffort);
      setIsSaving(true);
      setTuningStatus("Saving model");
      try {
        const nextStatus = await api.updateModelConfig({
          provider: modelStatus?.provider ?? "openai-compatible",
          baseUrl: modelStatus?.baseUrl,
          model: nextModel,
          temperature: modelStatus?.temperature,
          maxOutputTokens: modelStatus?.maxOutputTokens,
          reasoningEffort: openAiProtocol ? nextReasoning : undefined,
        });
        onModelStatus(nextStatus);
        setTuningStatus(nextStatus.configured ? "Model saved." : nextStatus.message ?? "Model saved.");
      } catch (error) {
        setTuningStatus(getErrorMessage(error));
      } finally {
        setIsSaving(false);
      }
    },
    [api, currentModel, modelStatus, onModelStatus, openAiProtocol, reasoningEffort],
  );

  const addCommand = useCallback(
    (command: string) => {
      const nextValue = prompt.trim() ? `${command} ${prompt.replace(/^\/\S+\s*/, "")}` : `${command} `;
      onPromptChange(nextValue);
    },
    [onPromptChange, prompt],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === id);
      if (target?.src?.startsWith("blob:")) URL.revokeObjectURL(target.src);
      return current.filter((attachment) => attachment.id !== id);
    });
  }, []);

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        const id = makeId("attachment");
        const src = file.type.startsWith("image/") || file.type.startsWith("video/") ? URL.createObjectURL(file) : undefined;
        setAttachments((current) => [
          ...current,
          {id, name: file.name, size: file.size, mimeType: file.type, src, status: "uploading", message: "Uploading"},
        ]);
        void api
          .uploadDocument(file)
          .then((job) => {
            onJob(job);
            setAttachments((current) =>
              current.map((attachment) =>
                attachment.id === id
                  ? {...attachment, status: "ready", message: job.message ?? "Queued for knowledge import", jobId: job.jobId}
                  : attachment,
              ),
            );
          })
          .catch((error) => {
            setAttachments((current) =>
              current.map((attachment) =>
                attachment.id === id ? {...attachment, status: "error", message: getErrorMessage(error)} : attachment,
              ),
            );
          });
      });
    },
    [api, onJob],
  );

  return (
    <div className="composer-dock shrink-0 bg-background px-4 py-3 md:px-6">
      <div className="review-composer mx-auto flex w-full max-w-[820px] flex-col gap-3">
        <div className="composer-workflow-row">
          <Button className="composer-workflow-button" size="sm" style={COMPOSER_BUTTON_STYLE} variant="outline">
            <Route className="size-4" />
            <span>Auto</span>
            <span className="composer-workflow-meta">{routeMeta}</span>
          </Button>
          <Button
            className="composer-workflow-button hidden sm:inline-flex"
            isDisabled={!openAiProtocol}
            size="sm"
            style={COMPOSER_BUTTON_STYLE}
            variant="outline"
            onPress={() => void refreshModels()}
          >
            <RefreshCw className="size-4" />
            <span>{isLoadingModels ? "Loading" : "Models"}</span>
            <span className="composer-workflow-meta">{modelStatus?.configured ? "Upstream" : "Missing"}</span>
          </Button>
          <ComposerActionsPopover isRunning={isRunning} onCommand={addCommand} />
        </div>

        <ChatAttachmentInput accept=".md,.txt,.pdf,.doc,.docx,.json,.csv,image/*" multiple onFilesSelected={handleFilesSelected}>
          <ChatAttachmentInput.Dropzone>
            <PromptInput
              className="group min-w-0 max-w-full overflow-hidden"
              layout="compact"
              lockInputOnRun={false}
              status={status}
              value={prompt}
              onStop={onStop}
              onSubmit={onSend}
              onValueChange={onPromptChange}
            >
              <PromptInput.Shell>
                {attachments.length ? (
                  <PromptInput.Attachments>
                    <ChatAttachmentGroup className="flex flex-wrap gap-2">
                      {attachments.map((attachment) => (
                        <ChatAttachment
                          key={attachment.id}
                          mediaType={inferChatAttachmentMediaType(attachment.mimeType)}
                          mimeType={attachment.mimeType}
                          name={attachment.name}
                          src={attachment.src}
                          title={attachment.message}
                        >
                          <ChatAttachment.Name>
                            {attachment.name}
                            <span className="ml-1 text-muted">
                              {attachment.status === "uploading" ? "uploading" : formatFileSize(attachment.size)}
                            </span>
                          </ChatAttachment.Name>
                          <ChatAttachment.Remove aria-label={`Remove ${attachment.name}`} onPress={() => removeAttachment(attachment.id)}>
                            <X className="size-3" />
                          </ChatAttachment.Remove>
                        </ChatAttachment>
                      ))}
                    </ChatAttachmentGroup>
                  </PromptInput.Attachments>
                ) : null}
                <PromptInput.Content>
                  <PromptInput.TextArea className="composer-textarea min-w-0" placeholder="Message Auto" />
                </PromptInput.Content>
                <PromptInput.Toolbar className="group-data-[expanded=true]:justify-start group-data-[expanded=true]:gap-1.5 sm:group-data-[expanded=true]:justify-between">
                  <PromptInput.ToolbarStart>
                    <ChatAttachmentInput.Trigger
                      aria-label="Add context"
                      render={(triggerProps) => (
                        <PromptInput.Action
                          {...triggerProps}
                          aria-label="Add context"
                          className="bg-default text-muted hover:bg-default-hover"
                          tooltip="Add context"
                        >
                          <Plus className="size-4" />
                        </PromptInput.Action>
                      )}
                    />
                  </PromptInput.ToolbarStart>
                  <PromptInput.ToolbarEnd className="flex min-w-0 gap-1.5 group-data-[expanded=true]:!flex">
                    {selectedModel ? (
                      <ModelSelectControl
                        className="hidden w-auto min-w-0 sm:inline-flex"
                        disabled={!openAiProtocol || isSaving}
                        isLoadingModels={isLoadingModels}
                        model={selectedModel}
                        models={availableModels}
                        modelsStatus={modelsStatus}
                        popoverPlacement="top"
                        reasoningEffort={reasoningEffort}
                        selectedKey={selectedModel.id}
                        tuningStatus={tuningStatus}
                        onRefreshModels={() => void refreshModels()}
                        onReasoningChange={(reasoning) => void saveTuning({reasoning})}
                        onSelectionChange={(model) => void saveTuning({model})}
                      />
                    ) : null}
                    {selectedModel ? (
                      <MobileModelSheet
                        disabled={!openAiProtocol || isSaving}
                        isLoadingModels={isLoadingModels}
                        model={selectedModel}
                        models={availableModels}
                        modelsStatus={modelsStatus}
                        reasoningEffort={reasoningEffort}
                        selectedKey={selectedModel.id}
                        tuningStatus={tuningStatus}
                        onRefreshModels={() => void refreshModels()}
                        onReasoningChange={(reasoning) => void saveTuning({reasoning})}
                        onSelectionChange={(model) => void saveTuning({model})}
                      />
                    ) : null}
                    {hasValue ? (
                      <>
                        <PromptInput.Action
                          aria-label="Voice input"
                          className="bg-transparent text-muted hover:bg-default-hover"
                          tooltip="Voice input"
                        >
                          <Mic className="size-4" />
                        </PromptInput.Action>
                        <PromptInput.Send aria-label="Send message" className="composer-send-button" isDisabled={!hasValue}>
                          <ArrowUp className="size-4" />
                        </PromptInput.Send>
                      </>
                    ) : (
                      <PromptInput.Action
                        aria-label="Voice input"
                        className="composer-send-button"
                        tooltip="Voice input"
                      >
                        <Mic className="size-4" />
                      </PromptInput.Action>
                    )}
                  </PromptInput.ToolbarEnd>
                </PromptInput.Toolbar>
              </PromptInput.Shell>
            </PromptInput>
          </ChatAttachmentInput.Dropzone>
        </ChatAttachmentInput>

        <div className="composer-status-row">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <span className="flex min-w-0 items-center gap-1.5">
              <Route className="size-4 shrink-0" />
              <span className="truncate">{route}</span>
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <Monitor className="size-4 shrink-0" />
              <span className="truncate">{inferProviderLabel(modelStatus)}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ProgressCircle aria-label="Chat run progress" color={status === "error" ? "danger" : "default"} size="sm" value={progressValue}>
              <ProgressCircle.Track>
                <ProgressCircle.TrackCircle />
                <ProgressCircle.FillCircle />
              </ProgressCircle.Track>
            </ProgressCircle>
            <span className="tabular-nums">{statusText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

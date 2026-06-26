import {useState} from "react";
import {Check, ChevronDown, ChevronRight, RefreshCw} from "lucide-react";

import {Button} from "@heroui/react/button";
import {Popover} from "@heroui/react/popover";
import {Separator} from "@heroui/react/separator";

import {MODEL_PICKER_REASONING_EFFORTS} from "../../lib/constants";
import {
  type ComposerModel,
  modelPickerModelLabel,
  modelPickerReasoningLabel,
  normalizeReasoningEffort,
} from "../../lib/model";
import type {ReasoningEffort} from "../../types";

export function ReviewModelText({compact = false, model}: {compact?: boolean; model: ComposerModel}) {
  return (
    <span
      className={`composer-model-text ${compact ? "composer-model-text--compact" : ""} flex min-w-0 items-center gap-1`}
    >
      <span className="truncate font-normal">{compact ? model.id : model.name}</span>
      {model.meta ? <span className="shrink-0 font-normal text-muted">· {model.meta}</span> : null}
    </span>
  );
}

export function ModelPickerMenu({
  defaultExpanded = false,
  isLoadingModels,
  model,
  models,
  modelsStatus,
  onClose,
  onRefreshModels,
  onReasoningChange,
  onSelectionChange,
  reasoningEffort,
  selectedKey,
  tuningStatus,
  variant = "popover",
}: {
  defaultExpanded?: boolean;
  isLoadingModels: boolean;
  model: ComposerModel;
  models: ComposerModel[];
  modelsStatus: string | null;
  onClose?: () => void;
  onRefreshModels: () => void;
  onReasoningChange: (value: ReasoningEffort) => void;
  onSelectionChange: (key: string) => void;
  reasoningEffort: ReasoningEffort;
  selectedKey: string;
  tuningStatus: string | null;
  variant?: "popover" | "sheet";
}) {
  const selectedReasoning = normalizeReasoningEffort(reasoningEffort);
  const modelOptions = models.length > 0 ? models : [model];
  const [isModelListExpanded, setIsModelListExpanded] = useState(defaultExpanded);

  return (
    <div className={`model-picker-menu model-picker-menu--${variant}`} data-models-expanded={isModelListExpanded}>
      <section aria-label="Reasoning effort" className="model-picker-panel model-picker-panel--reasoning">
        <div className="model-picker-heading">推理</div>
        <div className="model-picker-list">
          {MODEL_PICKER_REASONING_EFFORTS.map((effort) => {
            const selected = selectedReasoning === effort.value;
            return (
              <button
                key={effort.value}
                className="model-picker-row"
                data-selected={selected}
                type="button"
                onClick={() => onReasoningChange(effort.value)}
              >
                <span className="model-picker-row__label">{modelPickerReasoningLabel(effort.value)}</span>
                {selected ? <Check className="model-picker-check" /> : null}
              </button>
            );
          })}
        </div>
        <Separator className="model-picker-separator" />
        <button
          aria-expanded={isModelListExpanded}
          className="model-picker-row model-picker-row--branch"
          type="button"
          onClick={() => setIsModelListExpanded((current) => !current)}
        >
          <span className="model-picker-row__label">{modelPickerModelLabel(model)}</span>
          <ChevronRight className="model-picker-chevron" />
        </button>
        <button className="model-picker-refresh" type="button" onClick={onRefreshModels}>
          <span>{isLoadingModels ? "正在拉取模型" : "刷新上游模型"}</span>
          <RefreshCw className="size-3.5" />
        </button>
      </section>

      <section
        aria-hidden={!isModelListExpanded}
        aria-label="Model"
        className="model-picker-panel model-picker-panel--models"
      >
        <div className="model-picker-heading">模型</div>
        <div className="model-picker-list">
          {modelOptions.map((option) => {
            const selected = option.id === selectedKey;
            return (
              <button
                key={option.id}
                className="model-picker-row"
                data-selected={selected}
                type="button"
                onClick={() => {
                  onSelectionChange(option.id);
                  onClose?.();
                }}
              >
                <span className="model-picker-row__label">{modelPickerModelLabel(option)}</span>
                {selected ? <Check className="model-picker-check" /> : null}
              </button>
            );
          })}
        </div>
        {modelsStatus || tuningStatus ? (
          <div className="model-picker-status">{tuningStatus ?? modelsStatus}</div>
        ) : null}
      </section>
    </div>
  );
}

export function ModelSelectControl({
  className,
  disabled,
  isLoadingModels,
  model,
  models,
  modelsStatus,
  onRefreshModels,
  onReasoningChange,
  onSelectionChange,
  popoverPlacement = "top",
  reasoningEffort,
  selectedKey,
  tuningStatus,
}: {
  className?: string;
  disabled: boolean;
  isLoadingModels: boolean;
  model: ComposerModel;
  models: ComposerModel[];
  modelsStatus: string | null;
  onRefreshModels: () => void;
  onReasoningChange: (value: ReasoningEffort) => void;
  onSelectionChange: (key: string) => void;
  popoverPlacement?: "top" | "top end" | "top start" | "bottom end" | "bottom start";
  reasoningEffort: ReasoningEffort;
  selectedKey: string;
  tuningStatus: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className={className}>
      <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger>
          <Button
            aria-label="Choose model"
            className="model-select-trigger"
            isDisabled={disabled}
            size="sm"
            variant="ghost"
          >
            <ReviewModelText compact model={model} />
            <ChevronDown className="size-4 shrink-0 text-muted" />
          </Button>
        </Popover.Trigger>
        <Popover.Content className="model-picker-popover" containerPadding={12} offset={8} placement={popoverPlacement}>
          <Popover.Dialog className="model-picker-dialog">
            <ModelPickerMenu
              isLoadingModels={isLoadingModels}
              model={model}
              models={models}
              modelsStatus={modelsStatus}
              reasoningEffort={reasoningEffort}
              selectedKey={selectedKey}
              tuningStatus={tuningStatus}
              onClose={() => setIsOpen(false)}
              onRefreshModels={onRefreshModels}
              onReasoningChange={onReasoningChange}
              onSelectionChange={onSelectionChange}
            />
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </span>
  );
}

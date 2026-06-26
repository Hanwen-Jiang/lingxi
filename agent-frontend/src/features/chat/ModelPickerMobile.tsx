import {useEffect, useRef, useState} from "react";
import {ChevronDown, RefreshCw} from "lucide-react";

import {Button} from "@heroui/react/button";
import {Description} from "@heroui/react/description";
import {Label} from "@heroui/react/label";
import {ListBox} from "@heroui/react/list-box";
import {Sheet} from "@heroui-pro/react/sheet";

import {MODEL_PICKER_REASONING_EFFORTS} from "../../lib/constants";
import {
  type ComposerModel,
  modelPickerModelLabel,
  modelPickerReasoningLabel,
  normalizeReasoningEffort,
} from "../../lib/model";
import type {ReasoningEffort} from "../../types";

import {ReviewModelText} from "./ModelPicker";

function MobileModelPickerBody({
  isLoadingModels,
  model,
  models,
  modelsStatus,
  onRefreshModels,
  onReasoningChange,
  onSelectionChange,
  reasoningEffort,
  selectedKey,
  tuningStatus,
}: {
  isLoadingModels: boolean;
  model: ComposerModel;
  models: ComposerModel[];
  modelsStatus: string | null;
  onRefreshModels: () => void;
  onReasoningChange: (value: ReasoningEffort) => void;
  onSelectionChange: (key: string) => void;
  reasoningEffort: ReasoningEffort;
  selectedKey: string;
  tuningStatus: string | null;
}) {
  const selectedReasoning = normalizeReasoningEffort(reasoningEffort);
  const modelOptions = models.length > 0 ? models : [model];
  const status = tuningStatus ?? modelsStatus;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-1.5">
        <div className="px-1 text-xs font-semibold text-muted">推理强度</div>
        <ListBox
          aria-label="Reasoning effort"
          className="w-full"
          disallowEmptySelection
          selectedKeys={new Set([selectedReasoning])}
          selectionMode="single"
          onSelectionChange={(keys) => {
            if (keys === "all") return;
            const first = [...keys][0];
            if (first != null) onReasoningChange(String(first) as ReasoningEffort);
          }}
        >
          {MODEL_PICKER_REASONING_EFFORTS.map((effort) => (
            <ListBox.Item key={effort.value} id={effort.value} textValue={modelPickerReasoningLabel(effort.value)}>
              <Label>{modelPickerReasoningLabel(effort.value)}</Label>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </section>

      <section className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-muted">模型</span>
          <Button isDisabled={isLoadingModels} size="sm" variant="ghost" onPress={onRefreshModels}>
            <RefreshCw className={`size-3.5 ${isLoadingModels ? "animate-spin" : ""}`} />
            <span className="text-xs">{isLoadingModels ? "拉取中" : "刷新"}</span>
          </Button>
        </div>
        <ListBox
          aria-label="Model"
          className="w-full"
          disallowEmptySelection
          selectedKeys={new Set([selectedKey])}
          selectionMode="single"
          onSelectionChange={(keys) => {
            if (keys === "all") return;
            const first = [...keys][0];
            if (first != null) onSelectionChange(String(first));
          }}
        >
          {modelOptions.map((option) => (
            <ListBox.Item key={option.id} id={option.id} textValue={modelPickerModelLabel(option)}>
              <div className="flex min-w-0 flex-col">
                <Label className="truncate">{modelPickerModelLabel(option)}</Label>
                {option.provider ? <Description className="truncate">{option.provider}</Description> : null}
              </div>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
        {status ? <p className="px-1 text-xs text-muted">{status}</p> : null}
      </section>
    </div>
  );
}

export function MobileModelSheet({
  disabled,
  isLoadingModels,
  model,
  models,
  modelsStatus,
  onRefreshModels,
  onReasoningChange,
  onSelectionChange,
  reasoningEffort,
  selectedKey,
  tuningStatus,
}: {
  disabled: boolean;
  isLoadingModels: boolean;
  model: ComposerModel;
  models: ComposerModel[];
  modelsStatus: string | null;
  onRefreshModels: () => void;
  onReasoningChange: (value: ReasoningEffort) => void;
  onSelectionChange: (key: string) => void;
  reasoningEffort: ReasoningEffort;
  selectedKey: string;
  tuningStatus: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Close the sheet once a model change has actually committed (selectedKey updates
  // after the save round-trip). Doing it here, off the ListBox selection event,
  // avoids the save-driven re-render swallowing an inline setIsOpen(false).
  // Reasoning changes don't touch selectedKey, so they keep the sheet open.
  const committedModelKey = useRef(selectedKey);
  useEffect(() => {
    if (selectedKey !== committedModelKey.current) {
      committedModelKey.current = selectedKey;
      setIsOpen(false);
    }
  }, [selectedKey]);

  return (
    <Sheet isDetached isOpen={isOpen} placement="bottom" onOpenChange={setIsOpen}>
      <Sheet.Trigger>
        <Button
          aria-label="Choose model"
          className="model-select-trigger model-select-trigger--mobile"
          isDisabled={disabled}
          size="sm"
          variant="ghost"
        >
          <ReviewModelText compact model={model} />
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </Button>
      </Sheet.Trigger>
      <Sheet.Backdrop>
        <Sheet.Content className="model-sheet-content">
          <Sheet.Dialog className="model-sheet-dialog">
            <Sheet.Handle />
            <Sheet.Header className="items-start px-4 pb-2 pt-3">
              <Sheet.Heading className="text-base font-semibold">Model</Sheet.Heading>
              <p className="text-xs text-muted">
                <ReviewModelText compact model={model} />
              </p>
            </Sheet.Header>
            <Sheet.Body className="scrollbar min-h-0 overflow-y-auto px-4 pb-5">
              <MobileModelPickerBody
                isLoadingModels={isLoadingModels}
                model={model}
                models={models}
                modelsStatus={modelsStatus}
                reasoningEffort={reasoningEffort}
                selectedKey={selectedKey}
                tuningStatus={tuningStatus}
                onRefreshModels={onRefreshModels}
                onReasoningChange={onReasoningChange}
                onSelectionChange={onSelectionChange}
              />
            </Sheet.Body>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}

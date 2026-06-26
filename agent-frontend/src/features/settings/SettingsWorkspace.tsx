import {ArrowLeft, HeartPulse, RefreshCw, Settings} from "lucide-react";

import {Button} from "@heroui/react/button";
import {Chip} from "@heroui/react/chip";
import {ScrollShadow} from "@heroui/react/scroll-shadow";

import {PanelTitle, ReadOnlyField} from "../../components/ui/primitives";
import type {ApiClient} from "../../api";
import type {DocumentIngestJobResponse, MemoryItem, ModelStatusResponse} from "../../types";
import {DesktopSidebarTrigger, MobileWorkspaceSheet} from "../sidebar/GlobalSidebar";

import {IngestionPanel} from "./IngestionPanel";
import {MemoryPanel} from "./MemoryPanel";
import {ModelConfigPanel} from "./ModelConfigPanel";

export function SettingsWorkspace({
  api,
  apiBase,
  health,
  healthMessage,
  jobs,
  memoryItems,
  modelStatus,
  sessionId,
  userId,
  onBack,
  onCheckHealth,
  onJob,
  onMemoryItems,
  onModelStatus,
  onNavigate,
  onRefreshMemories,
}: {
  api: ApiClient;
  apiBase: string;
  health: "checking" | "up" | "down";
  healthMessage: string;
  jobs: DocumentIngestJobResponse[];
  memoryItems: MemoryItem[];
  modelStatus: ModelStatusResponse | null;
  sessionId: number;
  userId: number;
  onBack: () => void;
  onCheckHealth: () => void;
  onJob: (job: DocumentIngestJobResponse) => void;
  onMemoryItems: (items: MemoryItem[]) => void;
  onModelStatus: (status: ModelStatusResponse) => void;
  onNavigate: (view: "chat" | "settings") => void;
  onRefreshMemories: () => void;
}) {
  return (
    <main className="settings-page flex h-svh min-w-0 flex-col overflow-hidden bg-background">
      <header className="settings-header flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-separator px-4 md:px-6">
        <div className="flex items-center gap-3">
          <DesktopSidebarTrigger />
          <MobileWorkspaceSheet health={health} view="settings" onNavigate={onNavigate} />
          <Button className="control-button header-action-button" size="sm" variant="outline" onPress={onBack}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <div>
            <h1 className="text-base font-semibold">Settings</h1>
            <p className="settings-header__subtitle text-muted">
              Runtime context, knowledge import, and memory management.
            </p>
          </div>
        </div>
        <Button
          aria-label="Refresh backend status"
          className="control-button header-action-button whitespace-nowrap"
          size="sm"
          variant="outline"
          onPress={onCheckHealth}
        >
          <RefreshCw className="size-4" />
          <span className="sm:hidden">Refresh</span>
          <span className="hidden sm:inline">Refresh status</span>
        </Button>
      </header>
      <ScrollShadow className="min-h-0 flex-1 overflow-y-auto" hideScrollBar>
        <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 md:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SettingsPanel
            api={api}
            apiBase={apiBase}
            health={health}
            healthMessage={healthMessage}
            modelStatus={modelStatus}
            sessionId={sessionId}
            userId={userId}
            onModelStatus={onModelStatus}
          />
          <IngestionPanel api={api} jobs={jobs} onJob={onJob} />
          <MemoryPanel
            api={api}
            items={memoryItems}
            sessionId={sessionId}
            userId={userId}
            onItems={onMemoryItems}
            onRefresh={onRefreshMemories}
          />
        </div>
      </ScrollShadow>
    </main>
  );
}

function SettingsPanel({
  api,
  apiBase,
  health,
  healthMessage,
  modelStatus,
  sessionId,
  userId,
  onModelStatus,
}: {
  api: ApiClient;
  apiBase: string;
  health: "checking" | "up" | "down";
  healthMessage: string;
  modelStatus: ModelStatusResponse | null;
  sessionId: number;
  userId: number;
  onModelStatus: (status: ModelStatusResponse) => void;
}) {
  return (
    <section className="space-y-5">
      <PanelTitle icon={<Settings className="size-4" />} title="Runtime Context" />
      <div className="panel-section runtime-context-panel" aria-label="Runtime context">
        <ReadOnlyField label="API base" value={apiBase} />
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyField label="User ID" value={userId} />
          <ReadOnlyField label="Session ID" value={sessionId} />
        </div>
      </div>
      <div className="panel-section">
        <PanelTitle icon={<HeartPulse className="size-4" />} title="Backend Status" />
        <div className="flex flex-wrap gap-2">
          <Chip color={health === "up" ? "success" : "danger"} variant="soft">
            {healthMessage}
          </Chip>
          <Chip color={modelStatus?.configured ? "success" : "warning"} variant="soft">
            {modelStatus?.message ?? "Model status unknown"}
          </Chip>
        </div>
        <p className="text-sm leading-6 text-muted">
          Provider: {modelStatus?.provider ?? "unknown"} · Model: {modelStatus?.model ?? "unknown"}
        </p>
      </div>
      <ModelConfigPanel api={api} modelStatus={modelStatus} onModelStatus={onModelStatus} />
    </section>
  );
}

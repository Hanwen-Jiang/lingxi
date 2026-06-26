import {useCallback, useEffect, useState} from "react";
import {MessageSquare, RefreshCw, Settings} from "lucide-react";

import {Button} from "@heroui/react/button";
import {Chip} from "@heroui/react/chip";
import {Sheet} from "@heroui-pro/react/sheet";

import {useMediaQuery} from "../../hooks/useMediaQuery";
import {statusTone} from "../../lib/chat";
import {MOBILE_NAV_QUERY} from "../../lib/constants";
import {DesktopSidebarTrigger, MobileWorkspaceSheet} from "../sidebar/GlobalSidebar";
import {SessionListContent} from "../sessions/SessionList";
import type {ChatMode, ChatSessionSummary, ModelStatusResponse} from "../../types";

export function ChatHeader({
  activeSessionId,
  activeMode,
  health,
  modelStatus,
  query,
  session,
  sessions,
  totalSessions,
  onCheckHealth,
  onNavigate,
  onNewSession,
  onOpenSettings,
  onQueryChange,
  onRefreshSessions,
  onSelectSession,
}: {
  activeSessionId: number;
  activeMode: ChatMode;
  health: "checking" | "up" | "down";
  modelStatus: ModelStatusResponse | null;
  query: string;
  session: ChatSessionSummary | null;
  sessions: ChatSessionSummary[];
  totalSessions: number;
  onCheckHealth: () => void;
  onNavigate: (view: "chat" | "settings") => void;
  onNewSession: () => void;
  onOpenSettings: () => void;
  onQueryChange: (value: string) => void;
  onRefreshSessions: () => void;
  onSelectSession: (sessionId: number) => void;
}) {
  return (
    <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-separator bg-background px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <DesktopSidebarTrigger />
        <MobileWorkspaceSheet health={health} view="chat" onNavigate={onNavigate} />
        <MobileSessionSheet
          activeSessionId={activeSessionId}
          query={query}
          sessions={sessions}
          totalSessions={totalSessions}
          onNewSession={onNewSession}
          onQueryChange={onQueryChange}
          onRefresh={onRefreshSessions}
          onSelect={onSelectSession}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold md:text-base">{session?.title || activeMode.label}</h2>
            <Chip size="sm" variant="soft" color={statusTone(health === "up" ? "complete" : "error")}>
              {health === "up" ? "在线" : health === "checking" ? "连接中" : "离线"}
            </Chip>
            <Chip size="sm" variant="soft" color={modelStatus?.configured ? "success" : "warning"}>
              {modelStatus?.configured ? "灵犀已就绪" : "灵犀还没接上模型"}
            </Chip>
          </div>
          <p className="truncate text-xs text-muted">灵犀会根据你的问题自动挑选最合适的方式回答。</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button className="control-button header-action-button" size="sm" variant="outline" onPress={onCheckHealth}>
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">刷新</span>
        </Button>
        <Button
          isIconOnly
          aria-label="打开设置"
          className="icon-button"
          size="sm"
          variant="outline"
          onPress={onOpenSettings}
        >
          <Settings className="size-4" />
        </Button>
      </div>
    </header>
  );
}

function MobileSessionSheet({
  activeSessionId,
  query,
  sessions,
  totalSessions,
  onNewSession,
  onQueryChange,
  onRefresh,
  onSelect,
}: {
  activeSessionId: number;
  query: string;
  sessions: ChatSessionSummary[];
  totalSessions: number;
  onNewSession: () => void;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onSelect: (sessionId: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobileNav = useMediaQuery(MOBILE_NAV_QUERY);
  const handleNewSession = useCallback(() => {
    onNewSession();
    setIsOpen(false);
  }, [onNewSession]);
  const handleSelect = useCallback(
    (sessionId: number) => {
      onSelect(sessionId);
      setIsOpen(false);
    },
    [onSelect],
  );

  useEffect(() => {
    if (!isMobileNav && isOpen) setIsOpen(false);
  }, [isMobileNav, isOpen]);

  return (
    <Sheet
      isDetached
      isOpen={isMobileNav && isOpen}
      placement="left"
      snapPoints={["min(88vw,320px)"]}
      onOpenChange={setIsOpen}
    >
      <Sheet.Trigger>
        <Button
          isIconOnly
          aria-label="Open conversation history"
          className="sidebar-trigger sidebar-trigger--mobile"
          size="sm"
          variant="outline"
        >
          <MessageSquare className="size-4" />
        </Button>
      </Sheet.Trigger>
      <Sheet.Backdrop>
        <Sheet.Content className="max-w-[min(88vw,320px)]">
          <Sheet.Dialog className="flex h-full min-h-0 flex-col overflow-hidden p-0">
            <Sheet.Header className="sr-only">
              <Sheet.Heading>Conversation history</Sheet.Heading>
            </Sheet.Header>
            <SessionListContent
              activeSessionId={activeSessionId}
              query={query}
              sessions={sessions}
              totalSessions={totalSessions}
              onNewSession={handleNewSession}
              onQueryChange={onQueryChange}
              onRefresh={onRefresh}
              onSelect={handleSelect}
            />
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}

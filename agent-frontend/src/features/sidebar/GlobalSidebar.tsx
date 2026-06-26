import {useCallback, useEffect, useState} from "react";
import {MessageSquare, Moon, PanelLeft, Settings, Sparkles, Sun} from "lucide-react";

import {Button} from "@heroui/react/button";
import {Sheet} from "@heroui-pro/react/sheet";
import {Sidebar} from "@heroui-pro/react/sidebar";

import {useColorScheme} from "../../hooks/useColorScheme";
import {useMediaQuery} from "../../hooks/useMediaQuery";
import {MOBILE_NAV_QUERY} from "../../lib/constants";

export function SidebarThemeToggle() {
  const {isDark, toggle} = useColorScheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="flex min-h-9 w-full items-center gap-3 rounded-2xl px-2 text-sm text-foreground transition-colors hover:bg-default"
    >
      <span className="grid size-5 shrink-0 place-items-center text-muted">
        {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-left" data-sidebar="label">
        {isDark ? "Dark" : "Light"}
      </span>
    </button>
  );
}

export function DesktopSidebarTrigger() {
  return (
    <Sidebar.Trigger aria-label="Toggle workspace navigation" className="sidebar-trigger sidebar-trigger--desktop">
      <PanelLeft className="size-4" />
    </Sidebar.Trigger>
  );
}

export function GlobalSidebar({
  health,
  view,
  onNavigate,
}: {
  health: "checking" | "up" | "down";
  view: "chat" | "settings";
  onNavigate: (view: "chat" | "settings") => void;
}) {
  const healthClass = health === "up" ? "bg-success" : health === "checking" ? "bg-warning" : "bg-danger";

  return (
    <>
      <Sidebar className="hidden lg:flex">
        <GlobalSidebarContents healthClass={healthClass} health={health} view={view} onNavigate={onNavigate} />
      </Sidebar>
    </>
  );
}

export function MobileWorkspaceSheet({
  health,
  view,
  onNavigate,
}: {
  health: "checking" | "up" | "down";
  view: "chat" | "settings";
  onNavigate: (view: "chat" | "settings") => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobileNav = useMediaQuery(MOBILE_NAV_QUERY);
  const healthClass = health === "up" ? "bg-success" : health === "checking" ? "bg-warning" : "bg-danger";
  const handleNavigate = useCallback(
    (nextView: "chat" | "settings") => {
      onNavigate(nextView);
      setIsOpen(false);
    },
    [onNavigate],
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
          aria-label="Open navigation"
          className="sidebar-trigger sidebar-trigger--mobile"
          size="sm"
          variant="outline"
        >
          <PanelLeft className="size-4" />
        </Button>
      </Sheet.Trigger>
      <Sheet.Backdrop variant="blur">
        <Sheet.Content className="sidebar__mobile-sheet max-w-[min(88vw,320px)]">
          <Sheet.Dialog className="sidebar__mobile-dialog">
            <Sheet.Header className="sr-only">
              <Sheet.Heading>Workspace navigation</Sheet.Heading>
            </Sheet.Header>
            <div className="sidebar__mobile" data-slot="sidebar-mobile">
              <GlobalSidebarContents
                healthClass={healthClass}
                health={health}
                idPrefix="mobile-"
                view={view}
                onNavigate={handleNavigate}
              />
            </div>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}

function GlobalSidebarContents({
  healthClass,
  health,
  idPrefix = "",
  view,
  onNavigate,
}: {
  healthClass: string;
  health: "checking" | "up" | "down";
  idPrefix?: string;
  view: "chat" | "settings";
  onNavigate: (view: "chat" | "settings") => void;
}) {
  return (
    <>
      <Sidebar.Header>
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="grid size-9 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0" data-sidebar="label">
            <div className="truncate text-sm font-semibold">InfiniteChat</div>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span className={`size-1.5 rounded-full ${healthClass}`} />
              <span>{health === "up" ? "Backend ready" : health === "checking" ? "Checking" : "Offline"}</span>
            </div>
          </div>
        </div>
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Workspace</Sidebar.GroupLabel>
          <Sidebar.Menu aria-label="Workspace navigation">
            <Sidebar.MenuItem
              id={`${idPrefix}chat`}
              isCurrent={view === "chat"}
              textValue="Chat"
              onAction={() => onNavigate("chat")}
            >
              <Sidebar.MenuIcon>
                <MessageSquare className="size-4" />
              </Sidebar.MenuIcon>
              <Sidebar.MenuLabel>Chat</Sidebar.MenuLabel>
            </Sidebar.MenuItem>
            <Sidebar.MenuItem
              id={`${idPrefix}settings`}
              isCurrent={view === "settings"}
              textValue="Settings"
              onAction={() => onNavigate("settings")}
            >
              <Sidebar.MenuIcon>
                <Settings className="size-4" />
              </Sidebar.MenuIcon>
              <Sidebar.MenuLabel>Settings</Sidebar.MenuLabel>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Group>
      </Sidebar.Content>
      <Sidebar.Footer>
        <SidebarThemeToggle />
      </Sidebar.Footer>
    </>
  );
}

import type {ButtonHTMLAttributes} from "react";

import {Bell, Moon, Sun} from "lucide-react";
import {NavLink, Outlet, useLocation} from "react-router";

import {
  Avatar,
  cn,
  ConnectionBanner,
  LingxiGlyph,
  RailIcon,
  RailIconSprite,
  useTheme,
} from "@infinitechat/design-system";

import {api} from "@/api";
import {useUiStore} from "@/store/ui";
import {DESTINATIONS, isActive, titleFor} from "./navigation";
import {useWsBridge} from "./useWsBridge";

/** Lightweight top text-tabs for the two high-frequency contexts (DESIGN.md). */
const TEXT_TABS = [
  {to: "/messages", label: "消息"},
  {to: "/assistant", label: "灵犀"},
];

export function AppShell() {
  useWsBridge();
  const location = useLocation();
  const {theme, toggleTheme} = useTheme();
  const connection = useUiStore((s) => s.connection);
  const me = api.me();
  const title = titleFor(location.pathname);

  return (
    <div className="flex h-screen min-w-0 overflow-hidden bg-background text-foreground">
      <RailIconSprite />

      {/* Icon rail — tablet & desktop only (DESIGN.md §5/§8). */}
      <nav
        aria-label="主导航"
        className="hidden w-16 shrink-0 flex-col items-center gap-1 border-r border-separator px-2 py-3 md:flex"
      >
        <NavLink to="/" aria-label="灵犀 首页" className="mb-2 grid size-10 place-items-center">
          <LingxiGlyph title="灵犀" className="text-[#006fee]" />
        </NavLink>
        {DESTINATIONS.map((d) => (
          <NavLink
            key={d.to}
            to={d.to}
            end={d.to === "/"}
            title={d.label}
            className={({isActive: active}) =>
              cn(
                "grid size-11 place-items-center rounded-xl transition-colors",
                active
                  ? "bg-surface text-[var(--lx-accent)] shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_10%,transparent)]"
                  : "text-muted hover:bg-[color-mix(in_oklch,var(--foreground)_7%,transparent)] hover:text-foreground",
              )
            }
          >
            <RailIcon name={d.icon} />
          </NavLink>
        ))}
        <div className="mt-auto">
          <NavLink to="/settings" aria-label="账号与设置" className="grid size-11 place-items-center">
            <Avatar name={me.name} size="sm" presence="online" />
          </NavLink>
        </div>
      </nav>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar — one line on phone (brand glyph + title + icon tools). */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-separator px-4">
          <LingxiGlyph title="灵犀" className="size-6 shrink-0 text-[#006fee] md:hidden" />
          <h1 className="truncate text-[0.9375rem] font-semibold tracking-[-0.01em]">{title}</h1>

          {/* Desktop text tabs */}
          <nav aria-label="快捷切换" className="ml-3 hidden items-center gap-1 md:flex">
            {TEXT_TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-sm font-medium transition-colors",
                  isActive(location.pathname, t.to)
                    ? "text-[var(--lx-accent)]"
                    : "text-muted hover:text-foreground",
                )}
              >
                {t.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ToolButton label="提醒">
              <Bell className="size-[18px]" />
            </ToolButton>
            <ToolButton
              label={theme === "dark" ? "切换到浅色" : "切换到深色"}
              aria-pressed={theme === "dark"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            </ToolButton>
            <NavLink
              to="/settings"
              aria-label="账号"
              className="ml-1 grid size-9 place-items-center rounded-lg md:hidden"
            >
              <Avatar name={me.name} size="sm" />
            </NavLink>
          </div>
        </header>

        <ConnectionBanner state={connection} />

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>

        {/* Bottom dock — phone only, destination-only, icon-only (DESIGN.md). */}
        <nav
          aria-label="主导航"
          className="flex shrink-0 items-center justify-around border-t border-separator px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden"
        >
          {DESTINATIONS.map((d) => (
            <NavLink
              key={d.to}
              to={d.to}
              end={d.to === "/"}
              aria-label={d.label}
              className={({isActive: active}) =>
                cn(
                  "grid size-11 place-items-center rounded-xl transition-colors",
                  active ? "text-[var(--lx-accent)]" : "text-muted",
                )
              }
            >
              <RailIcon name={d.icon} className="size-[22px]" />
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

function ToolButton({
  children,
  label,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {label: string}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_7%,transparent)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lx-accent)]"
      {...rest}
    >
      {children}
    </button>
  );
}

import {useState, type ReactNode} from "react";

import {Bell, Eye, Moon, Volume2} from "lucide-react";
import {useNavigate} from "react-router";

import {
  Avatar,
  Button,
  cn,
  DividerRow,
  Panel,
  SectionLabel,
  useTheme,
} from "@infinitechat/design-system";

import {api} from "@/api";
import {Page, SignalStrip} from "@/features/_shared/Page";

export function SettingsPage() {
  const navigate = useNavigate();
  const {theme, toggleTheme} = useTheme();
  const me = api.me();
  const [notify, setNotify] = useState(true);
  const [sound, setSound] = useState(false);
  const [receipts, setReceipts] = useState(true);

  return (
    <Page eyebrow="设置" title="偏好" aside={<AccountPanel name={me.name} id={me.id} onSignOut={() => navigate("/auth")} />}>
      <SignalStrip
        items={[
          {label: "主题", value: theme === "dark" ? "深色" : "浅色"},
          {label: "通知", value: notify ? "开" : "关"},
          {label: "已读回执", value: receipts ? "开" : "关"},
        ]}
      />

      <Panel className="mt-5">
        <div className="px-4 pb-1 pt-3">
          <SectionLabel>通用</SectionLabel>
        </div>
        <SettingRow icon={<Moon className="size-4" />} label="深色模式" status={theme === "dark" ? "已开启" : "已关闭"}>
          <Toggle checked={theme === "dark"} onChange={toggleTheme} label="深色模式" />
        </SettingRow>
        <SettingRow icon={<Bell className="size-4" />} label="消息通知" status={notify ? "已开启" : "已关闭"}>
          <Toggle checked={notify} onChange={() => setNotify((v) => !v)} label="消息通知" />
        </SettingRow>
        <SettingRow icon={<Volume2 className="size-4" />} label="提示音" status={sound ? "已开启" : "已关闭"}>
          <Toggle checked={sound} onChange={() => setSound((v) => !v)} label="提示音" />
        </SettingRow>
        <SettingRow icon={<Eye className="size-4" />} label="已读回执" status={receipts ? "已开启" : "已关闭"} last>
          <Toggle checked={receipts} onChange={() => setReceipts((v) => !v)} label="已读回执" />
        </SettingRow>
      </Panel>
    </Page>
  );
}

function SettingRow({
  icon,
  label,
  status,
  children,
  last,
}: {
  icon: ReactNode;
  label: string;
  status: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <DividerRow last={last}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[0.75rem] text-muted">{status}</div>
      </div>
      {children}
    </DividerRow>
  );
}

/** Compact toggle: a small primary track inside a larger touch target (DESIGN.md
 *  — not a full blue pill). */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="grid h-10 w-12 shrink-0 place-items-center focus-visible:outline-none"
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors",
          checked
            ? "bg-[var(--lx-accent)]"
            : "bg-[color-mix(in_oklch,var(--foreground)_18%,transparent)]",
        )}
      >
        <span
          className={cn(
            "size-4 rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}

function AccountPanel({name, id, onSignOut}: {name: string; id: string; onSignOut: () => void}) {
  return (
    <Panel>
      <div className="px-4 pb-1 pt-3">
        <SectionLabel>账号</SectionLabel>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar name={name} size="xl" presence="online" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="truncate text-[0.75rem] tabular-nums text-muted">ID {id}</div>
        </div>
      </div>
      <div className="border-t border-separator px-4 py-3">
        <Button variant="secondary" block onClick={onSignOut}>
          退出登录
        </Button>
      </div>
    </Panel>
  );
}

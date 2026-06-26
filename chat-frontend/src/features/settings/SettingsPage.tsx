import {useState, type ReactNode} from "react";

import {Bell, Eye, Moon, Volume2} from "lucide-react";
import {useNavigate} from "react-router";

import {
  Avatar,
  Button,
  DividerRow,
  Panel,
  SectionLabel,
  Switch,
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
          <Switch checked={theme === "dark"} onChange={toggleTheme} aria-label="深色模式" />
        </SettingRow>
        <SettingRow icon={<Bell className="size-4" />} label="消息通知" status={notify ? "已开启" : "已关闭"}>
          <Switch checked={notify} onChange={setNotify} aria-label="消息通知" />
        </SettingRow>
        <SettingRow icon={<Volume2 className="size-4" />} label="提示音" status={sound ? "已开启" : "已关闭"}>
          <Switch checked={sound} onChange={setSound} aria-label="提示音" />
        </SettingRow>
        <SettingRow icon={<Eye className="size-4" />} label="已读回执" status={receipts ? "已开启" : "已关闭"} last>
          <Switch checked={receipts} onChange={setReceipts} aria-label="已读回执" />
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

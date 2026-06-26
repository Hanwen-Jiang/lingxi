import {UserPlus} from "lucide-react";
import {useNavigate} from "react-router";

import {
  Avatar,
  Button,
  DividerRow,
  EmptyState,
  ErrorState,
  Panel,
  SectionLabel,
  SkeletonList,
} from "@infinitechat/design-system";

import {useApplies, useFriends} from "@/api/queries";
import {Page, SignalStrip} from "@/features/_shared/Page";

export function ContactsPage() {
  const navigate = useNavigate();
  const friends = useFriends();
  const applies = useApplies();
  const pending = (applies.data ?? []).filter((a) => a.status === "pending");

  return (
    <Page
      eyebrow="通讯录"
      title="联系人"
      aside={<AppliesPanel pending={pending} loading={applies.isLoading} />}
    >
      <SignalStrip
        items={[
          {label: "好友", value: friends.data?.length ?? "—"},
          {label: "新申请", value: pending.length},
          {label: "群聊", value: 1},
        ]}
      />

      <Panel className="mt-5">
        <div className="px-4 pb-1 pt-3">
          <SectionLabel>我的好友</SectionLabel>
        </div>
        {friends.isLoading ? (
          <SkeletonList rows={4} />
        ) : friends.isError ? (
          <ErrorState compact onRetry={() => friends.refetch()} />
        ) : (friends.data ?? []).length === 0 ? (
          <EmptyState
            title="还没有好友"
            description="在发现里认识新朋友,或接受好友申请。"
          />
        ) : (
          (friends.data ?? []).map((f, i, arr) => (
            <DividerRow key={f.id} last={i === arr.length - 1}>
              <Avatar name={f.name} size="md" presence={f.presence} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{f.name}</div>
                <div className="truncate text-[0.8125rem] text-muted">
                  {f.signature ?? "这个人很安静"}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => navigate("/messages")}>
                发消息
              </Button>
            </DividerRow>
          ))
        )}
      </Panel>
    </Page>
  );
}

function AppliesPanel({
  pending,
  loading,
}: {
  pending: {id: string; fromUser: {name: string}; reason: string}[];
  loading: boolean;
}) {
  return (
    <Panel>
      <div className="flex items-center gap-2 px-4 pb-1 pt-3">
        <UserPlus className="size-4 text-muted" aria-hidden="true" />
        <SectionLabel>好友申请</SectionLabel>
      </div>
      {loading ? (
        <SkeletonList rows={1} />
      ) : pending.length === 0 ? (
        <div className="px-4 py-6 text-center text-[0.8125rem] text-muted">没有新的申请</div>
      ) : (
        pending.map((a, i) => (
          <DividerRow key={a.id} last={i === pending.length - 1} className="flex-col items-stretch gap-2">
            <div className="flex items-center gap-3">
              <Avatar name={a.fromUser.name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.fromUser.name}</div>
                <div className="truncate text-[0.8125rem] text-muted">{a.reason}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end">
              <Button size="sm" variant="secondary">
                忽略
              </Button>
              <Button size="sm">接受</Button>
            </div>
          </DividerRow>
        ))
      )}
    </Panel>
  );
}

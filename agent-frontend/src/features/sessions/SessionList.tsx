import {MessageSquare, Plus, RefreshCw, Search} from "lucide-react";

import {Button} from "@heroui/react/button";
import {Chip} from "@heroui/react/chip";
import {ScrollShadow} from "@heroui/react/scroll-shadow";
import {ChatListView} from "@heroui-pro/react/chat-list-view";

import {statusTone} from "../../lib/chat";
import {formatTime} from "../../lib/format";
import type {ChatSessionSummary} from "../../types";

export function SessionList({
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
  return (
    <aside className="hidden min-h-0 min-w-0 border-r border-separator bg-surface-secondary/60 lg:flex lg:flex-col">
      <SessionListContent
        activeSessionId={activeSessionId}
        query={query}
        sessions={sessions}
        totalSessions={totalSessions}
        onNewSession={onNewSession}
        onQueryChange={onQueryChange}
        onRefresh={onRefresh}
        onSelect={onSelect}
      />
    </aside>
  );
}

export function SessionListContent({
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
  return (
    <>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">Conversations</h1>
            <p className="truncate text-sm text-muted">
              {totalSessions ? `${totalSessions} real sessions` : "No saved sessions yet"}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              isIconOnly
              aria-label="Refresh sessions"
              className="icon-button"
              size="sm"
              variant="outline"
              onPress={onRefresh}
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button
              isIconOnly
              aria-label="New session"
              className="icon-button"
              size="sm"
              variant="outline"
              onPress={onNewSession}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        <label className="session-search">
          <Search className="size-4 shrink-0" />
          <input
            disabled={!totalSessions}
            placeholder={totalSessions ? "Search sessions" : "Search available after a session exists"}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
      </div>

      <ScrollShadow className="min-h-0 flex-1 overflow-y-auto px-3 pb-4" hideScrollBar>
        {sessions.length === 0 ? (
          <div className="rounded-lg bg-surface p-4 text-sm leading-6 text-muted shadow-surface">
            Send a message or create a session to populate real conversation history.
          </div>
        ) : (
          <ChatListView
            aria-label="Conversation sessions"
            className="session-list-view"
            density="compact"
            items={sessions}
            selectionBehavior="replace"
            selectionMode="single"
            selectedKeys={new Set([String(activeSessionId)])}
            onSelectionChange={(keys) => {
              if (keys === "all") return;

              const [key] = Array.from(keys);
              const sessionId = Number(key);

              if (Number.isFinite(sessionId)) onSelect(sessionId);
            }}
          >
            {(session) => (
              <ChatListView.Item
                key={String(session.sessionId)}
                id={String(session.sessionId)}
                textValue={session.title || "Conversation"}
              >
                <ChatListView.Icon>
                  <MessageSquare className="size-4" />
                </ChatListView.Icon>
                <ChatListView.ItemContent>
                  <ChatListView.Text>
                    <ChatListView.Title>{session.title || "Conversation"}</ChatListView.Title>
                    <ChatListView.Preview>
                      {session.summary || formatTime(session.lastMessageAt || session.updatedAt)}
                    </ChatListView.Preview>
                  </ChatListView.Text>
                  <ChatListView.Meta>
                    <Chip color={statusTone(session.lastStatus)} size="sm" variant="soft">
                      {session.turnCount ?? 0}
                    </Chip>
                  </ChatListView.Meta>
                </ChatListView.ItemContent>
              </ChatListView.Item>
            )}
          </ChatListView>
        )}
      </ScrollShadow>
    </>
  );
}

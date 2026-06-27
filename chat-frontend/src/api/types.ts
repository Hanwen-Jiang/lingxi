// Domain types for the IM client. All ids are `string` (D5: string-ified
// snowflake — JS number would corrupt precision). These mirror the chat-backend
// client contract (30-chat-backend-plan.md §5).
import type {DeliveryState} from "@infinitechat/design-system";

export type Id = string;

export type Presence = "online" | "offline" | "away";

export interface User {
  id: Id;
  name: string;
  avatar?: string;
  signature?: string;
  presence?: Presence;
}

/**
 * Auth session (03-contracts §7.1 LoginResponse, D14 email model). Identity is
 * the email; `token`/`refreshToken` drive Authorization + 401-refresh (D2). No
 * phone. Persisted to localStorage; the real flow replaces only the mock api.
 */
export interface AuthSession {
  userId: Id;
  userName: string;
  avatar?: string;
  token: string;
  refreshToken: string;
}

export type ConversationKind = "single" | "group" | "assistant";

export type MessageKind = "text" | "image" | "redpacket" | "system";

export interface Message {
  id: Id;
  /** Optimistic client id before the server assigns a real `id` (ADR 0002 §6). */
  clientTempId?: string;
  sessionId: Id;
  senderId: Id;
  kind: MessageKind;
  content: string;
  createdAt: number;
  delivery: DeliveryState;
  /** Assistant message currently streaming in (token-by-token). */
  streaming?: boolean;
}

/**
 * Assistant stream event (03-contracts §9: `{type, …}` + schema version `v`).
 * The Mock emits these; in P2 the real client parses the `/api/agent/chat` SSE
 * stream into the SAME events — so the UI never changes.
 */
export type AssistantStreamEvent =
  | {type: "start"; v: number}
  | {type: "delta"; v: number; text: string}
  | {type: "usage"; v: number; tokens: number}
  | {type: "done"; v: number}
  | {type: "error"; v: number; message: string};

export interface Conversation {
  id: Id; // sessionId
  kind: ConversationKind;
  title: string;
  avatar?: string;
  memberIds: Id[];
  lastMessage?: Message;
  lastMessageTime?: number;
  unreadCount: number;
  muted: boolean;
}

export interface Friend {
  id: Id;
  name: string;
  avatar?: string;
  signature?: string;
  presence?: Presence;
}

export interface FriendApply {
  id: Id;
  fromUser: User;
  reason: string;
  createdAt: number;
  status: "pending" | "accepted" | "rejected";
}

/** Cursor-paginated response (03-contracts §4: `{items, nextCursor, hasMore}`).
 *  `hasMore` is present on server/mock responses; optimistic local cache writes
 *  may omit it. */
export interface Page<T> {
  items: T[];
  nextCursor?: string;
  hasMore?: boolean;
}

/** WS push frame, normalized from PushTypeEnum (ADR 0002 / 30-plan §5.2). */
export type PushEvent =
  | {type: "message"; message: Message}
  | {type: "new-session"; sessionId: Id}
  | {type: "friend-application"}
  | {type: "presence"; userId: Id; presence: Presence};

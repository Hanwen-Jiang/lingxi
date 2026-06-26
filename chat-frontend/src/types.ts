// Domain types for the IM web client. These mirror the shapes returned by the
// `chat` backend (AuthenticationService / ContactService / MessagingService).

/** Standard envelope returned by every backend controller (`Result<T>`). */
export interface Result<T> {
  code: number;
  message: string;
  data: T;
}

export interface User {
  uuid: string;
  username: string;
  avatar: string;
  signature?: string;
}

export type MessageKind = "text" | "image" | "system";

export type DeliveryState = "sending" | "sent" | "read";

export interface Message {
  id: string;
  sessionId: string;
  senderUuid: string;
  kind: MessageKind;
  content: string;
  createdAt: number;
  state: DeliveryState;
}

export type ConversationKind = "single" | "group";

export interface Conversation {
  sessionId: string;
  kind: ConversationKind;
  /** Display name — friend's username for single chats, group name for groups. */
  title: string;
  avatar: string;
  memberUuids: string[];
  lastMessage?: Message;
  unread: number;
  muted: boolean;
}

/** A pending friend request surfaced by ContactService `/apply`. */
export interface FriendApply {
  id: string;
  fromUser: User;
  reason: string;
  createdAt: number;
  status: "pending" | "accepted" | "rejected";
}

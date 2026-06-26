// The API seam contract. Mock and (future) real branches implement the SAME
// signatures, so flipping VITE_API_BASE swaps data sources without touching UI
// (40-plan §4). The real branch lands in P2 as S3 ships B6/B7/B8/M9/M10/M11.
import type {
  Conversation,
  Friend,
  FriendApply,
  Id,
  Message,
  Page,
  PushEvent,
  User,
} from "./types";

export interface SendResult {
  message: Message;
}

export interface ListMessagesOptions {
  cursor?: string;
  limit?: number;
}

export interface Api {
  /** Current user (from the auth session; mock returns a fixed user). */
  me(): User;
  /** Lookup table for rendering sender names/avatars. */
  userMap(): Record<Id, User>;

  listConversations(): Promise<Conversation[]>; // B7
  listMessages(sessionId: Id, opts?: ListMessagesOptions): Promise<Page<Message>>; // B6
  listFriends(): Promise<Friend[]>; // M9
  listApplies(): Promise<FriendApply[]>;

  sendMessage(sessionId: Id, content: string): Promise<SendResult>; // POST /chat/session
  markRead(sessionId: Id): Promise<void>; // M10

  /** Subscribe to WS push (mock simulates the single-channel backend). Returns an
   *  unsubscribe. The real client (ADR 0002) adds reconnect/backoff/heartbeat/ack. */
  connectWs(onPush: (e: PushEvent) => void): () => void; // B8
}

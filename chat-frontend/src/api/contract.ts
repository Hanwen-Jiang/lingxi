// The API seam contract. Mock and (future) real branches implement the SAME
// signatures, so flipping VITE_API_BASE swaps data sources without touching UI
// (40-plan §4). The real branch lands in P2 as S3 ships B6/B7/B8/M9/M10/M11.
import type {
  AssistantStreamEvent,
  Conversation,
  Friend,
  FriendApply,
  Id,
  Message,
  Page,
  User,
} from "./types";
import type {WsTransport} from "./ws/transport";

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
  /** Accept or reject a friend application. Accept adds the applicant to friends. */
  respondApply(applyId: Id, accept: boolean): Promise<void>;

  sendMessage(sessionId: Id, content: string): Promise<SendResult>; // POST /chat/session
  markRead(sessionId: Id): Promise<void>; // M10

  /** Stream the 灵犀 assistant reply (Mock now; P2 = SSE `/api/agent/chat`). Emits
   *  AssistantStreamEvents; returns an abort function. */
  streamAssistant(
    sessionId: Id,
    content: string,
    onEvent: (e: AssistantStreamEvent) => void,
  ): () => void;

  /** Open a WS transport (mock: a simulated channel; real: a browser WebSocket via
   *  the B8 handshake). The WsClient (ADR 0002) layers reconnect/backoff/heartbeat/
   *  ack/dedup on top of this transport. */
  openWs(): WsTransport; // B8
}

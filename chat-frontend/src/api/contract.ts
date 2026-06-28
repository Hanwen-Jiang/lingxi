// The API seam contract. Mock and (future) real branches implement the SAME
// signatures, so flipping VITE_API_BASE swaps data sources without touching UI
// (40-plan §4). The real branch lands in P2 as S3 ships B6/B7/B8/M9/M10/M11.
import type {
  AssistantStreamEvent,
  AuthSession,
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

/** A file uploaded to object storage via the M11 presigned-PUT flow. `fileUrl` is
 *  the CDN URL embedded into the outgoing message body (03-contracts 媒体上传契约). */
export interface UploadedMedia {
  fileUrl: string;
  objectKey: string;
  contentType: string;
}

export interface Api {
  /** Current user (from the auth session; mock returns a fixed user). */
  me(): User;
  /** Lookup table for rendering sender names/avatars. */
  userMap(): Record<Id, User>;

  // --- Auth (03-contracts §7.1 · D14 email model; no phone/SMS) ---
  /** Send an email verification code. POST /api/v1/user/sendMail {email} */
  sendMail(email: string): Promise<void>;
  /** Email + password login. POST /api/v1/user/login {email,password} */
  login(email: string, password: string): Promise<AuthSession>;
  /** Passwordless email-code login. POST /api/v1/user/loginCode {email,code} */
  loginCode(email: string, code: string): Promise<AuthSession>;
  /** Register with email + password + code. POST /api/v1/user/register */
  register(email: string, password: string, code: string): Promise<AuthSession>;
  /** Refresh tokens. POST /api/v1/user/refresh {refreshToken} */
  refresh(refreshToken: string): Promise<AuthSession>;

  listConversations(): Promise<Conversation[]>; // B7
  listMessages(sessionId: Id, opts?: ListMessagesOptions): Promise<Page<Message>>; // B6
  listFriends(): Promise<Friend[]>; // M9
  listApplies(): Promise<FriendApply[]>;
  /** Accept or reject a friend application. Accept adds the applicant to friends. */
  respondApply(applyId: Id, accept: boolean): Promise<void>;

  sendMessage(sessionId: Id, content: string): Promise<SendResult>; // POST /chat/session (text)
  markRead(sessionId: Id): Promise<void>; // M10

  /** Upload a file to object storage (M11): POST /api/v1/user/media/upload-url for
   *  a presigned PUT, then PUT the bytes. Returns the CDN `fileUrl` to embed. */
  uploadMedia(file: File): Promise<UploadedMedia>;
  /** Send an image message (type=2 PICTURE). `fileUrl` is a previously uploaded
   *  media URL; body = {url, size}. POST /chat/session. */
  sendImageMessage(sessionId: Id, fileUrl: string, size?: number): Promise<SendResult>; // POST /chat/session (image)

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

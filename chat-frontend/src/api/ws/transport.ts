// WS transport + wire protocol (ADR 0002 / 30-chat-backend-plan §5.2).
//
// A WsTransport is a minimal WebSocket-like surface so the WsClient logic
// (reconnect/heartbeat/ack/dedup) is identical for the Mock transport and the
// real browser WebSocket. The wire frame is the backend's `MessageDTO`.
import type {Message, MessageKind, PushEvent} from "../types";

export interface WsTransport {
  send(data: string): void;
  close(): void;
  // The WsClient assigns these handlers.
  onopen?: () => void;
  onmessage?: (data: string) => void;
  onclose?: (clean: boolean) => void;
  onerror?: () => void;
}

export type TransportFactory = () => WsTransport;

/** Outbound frame types (client→server) — `MessageTypeEnum`. */
export const OUT = {ACK: 1, LOG_OUT: 2, HEART_BEAT: 5} as const;

/** Inbound push types (server→client) — `PushTypeEnum`. */
export const PUSH = {
  NEW_SESSION: 1,
  MESSAGE: 2,
  MOMENT: 3,
  FRIEND_APPLICATION: 4,
  NEW_GROUP_SESSION: 5,
} as const;

export interface WireFrame {
  type: number;
  msgUuid?: string;
  data?: unknown;
}

export function encodeFrame(frame: WireFrame): string {
  return JSON.stringify(frame);
}

export function decodeFrame(data: string): WireFrame | null {
  try {
    const f = JSON.parse(data) as WireFrame;
    return typeof f?.type === "number" ? f : null;
  } catch {
    return null;
  }
}

function kindFromType(type: number | undefined): MessageKind {
  if (type === 2) return "image";
  if (type === 5) return "redpacket";
  return "text";
}

/**
 * Normalize a pushed message into the domain `Message`. Tolerant of two shapes:
 * the Mock emits a full domain Message; the real RTC push (model `TextMessage`/
 * `PictureMessage`) carries `{messageId, sessionId, sendUserId?, type, createdAt,
 * body:{content}|{size,url}}`. All ids are coerced to string so cache writes/keys
 * match (the RTC sessionId is already a string; messageId rides as a string).
 */
export function normalizePushedMessage(raw: unknown): Message | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const sessionId = r.sessionId != null ? String(r.sessionId) : "";
  if (!sessionId) return null;
  const id = r.messageId != null ? String(r.messageId) : r.id != null ? String(r.id) : "";
  const senderId = r.sendUserId != null ? String(r.sendUserId) : r.senderId != null ? String(r.senderId) : "";
  const type = typeof r.type === "number" ? r.type : undefined;
  const kind: MessageKind = typeof r.kind === "string" ? (r.kind as MessageKind) : kindFromType(type);
  const body = (r.body && typeof r.body === "object" ? (r.body as Record<string, unknown>) : undefined);
  let content = typeof r.content === "string" ? r.content : undefined;
  if (content === undefined && body) {
    content = kind === "image" ? String(body.url ?? "") : String(body.content ?? "");
  }
  const createdAt = typeof r.createdAt === "number" ? r.createdAt : Date.now();
  return {id, sessionId, senderId, kind, content: content ?? "", createdAt, delivery: "delivered"};
}

/** Map an inbound push frame to a normalized PushEvent for the cache layer. */
export function frameToPushEvent(frame: WireFrame): PushEvent | null {
  switch (frame.type) {
    case PUSH.MESSAGE: {
      const message = normalizePushedMessage(frame.data);
      return message ? {type: "message", message} : null;
    }
    case PUSH.NEW_SESSION:
    case PUSH.NEW_GROUP_SESSION:
      return {type: "new-session", sessionId: String((frame.data as {sessionId?: string})?.sessionId ?? "")};
    case PUSH.FRIEND_APPLICATION:
      return {type: "friend-application"};
    default:
      return null; // MOMENT and others: not handled by the IM cache yet
  }
}

/** Whether an inbound frame must be ACK'd. Real pushes carry a msgUuid; the
 *  heartbeat echo (type 5) does not — so msgUuid alone is the right test. (A
 *  `type !== HEART_BEAT` check would wrongly exclude NEW_GROUP_SESSION, which is
 *  also type 5 but carries a msgUuid.) */
export function frameNeedsAck(frame: WireFrame): boolean {
  return Boolean(frame.msgUuid);
}

// ---------------------------------------------------------------------------
// Handshake adapter (B8). The backend will pick ONE of these; we default to the
// query form (30-plan §5 lists it first) and flip a single flag once S3 finalizes.
// ---------------------------------------------------------------------------
export type HandshakeMode = "query" | "subprotocol";

export interface HandshakeConfig {
  /** ws(s):// origin of the gateway, e.g. ws://127.0.0.1:10010 */
  gatewayWsOrigin: string;
  token: string;
  userUuid: string;
  mode: HandshakeMode;
}

/** Build the (url, protocols) pair for `new WebSocket(url, protocols)`. */
export function buildHandshake(cfg: HandshakeConfig): {url: string; protocols?: string[]} {
  const base = `${cfg.gatewayWsOrigin}/api/v1/netty`;
  if (cfg.mode === "subprotocol") {
    // Token rides as a Sec-WebSocket-Protocol value (browsers can't set headers).
    return {url: `${base}?userUuid=${encodeURIComponent(cfg.userUuid)}`, protocols: [`token.${cfg.token}`]};
  }
  // Default: ?token=&userUuid= query (gateway still verifies subject==userUuid).
  const q = new URLSearchParams({token: cfg.token, userUuid: cfg.userUuid});
  return {url: `${base}?${q.toString()}`};
}

/** Real browser-WebSocket transport (used in P2 once B8 lands). */
export function createWebSocketTransport(cfg: HandshakeConfig): WsTransport {
  const {url, protocols} = buildHandshake(cfg);
  const ws = new WebSocket(url, protocols);
  const transport: WsTransport = {
    send: (data) => ws.readyState === WebSocket.OPEN && ws.send(data),
    close: () => ws.close(),
  };
  ws.onopen = () => transport.onopen?.();
  ws.onmessage = (e) => transport.onmessage?.(typeof e.data === "string" ? e.data : "");
  ws.onclose = (e) => transport.onclose?.(e.wasClean);
  ws.onerror = () => transport.onerror?.();
  return transport;
}

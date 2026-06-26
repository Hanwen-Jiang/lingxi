// WS client (ADR 0002 §3.3). Transport-agnostic: identical logic for the Mock
// transport and the real browser WebSocket. Responsibilities:
//   2. heartbeat (< server 5-min reader-idle)
//   3. reconnect with exponential backoff + jitter (vs. explicit stop)
//   4. ACK inbound pushes AFTER they're handed to the cache layer
//   6. dedup by msgUuid (at-least-once redelivery overlaps with backfill)
// Backfill on reconnect (3) is delegated to `onReconnect` (a react-query refetch).
import type {ConnectionState} from "@infinitechat/design-system";

import type {PushEvent} from "../types";
import {
  OUT,
  decodeFrame,
  encodeFrame,
  frameNeedsAck,
  frameToPushEvent,
  type TransportFactory,
  type WireFrame,
  type WsTransport,
} from "./transport";

export interface WsClientOptions {
  transportFactory: TransportFactory;
  onState: (s: ConnectionState) => void;
  onPush: (e: PushEvent) => void;
  /** Fired when a connection RE-opens (not the first) — backfill the gap. */
  onReconnect?: () => void;
  heartbeatMs?: number;
  backoffBaseMs?: number;
  backoffCapMs?: number;
  dedupWindow?: number;
}

export class WsClient {
  private readonly o: Required<Omit<WsClientOptions, "onReconnect">> & Pick<WsClientOptions, "onReconnect">;
  private transport: WsTransport | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnect: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private stopped = false;
  private hadConnection = false;
  private state: ConnectionState = "offline";
  private readonly seen = new Set<string>();
  private readonly seenOrder: string[] = [];

  constructor(options: WsClientOptions) {
    this.o = {
      heartbeatMs: 30_000,
      backoffBaseMs: 600,
      backoffCapMs: 30_000,
      dedupWindow: 500,
      ...options,
    };
  }

  start(): void {
    this.stopped = false;
    this.open();
  }

  /** Explicit teardown (logout / unmount) — no reconnect. */
  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.transport?.close();
    this.transport = null;
    this.setState("offline");
  }

  private open(): void {
    this.setState(this.hadConnection ? "reconnecting" : "connecting");
    let t: WsTransport;
    try {
      t = this.o.transportFactory();
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.transport = t;
    // Ignore handlers from a transport that's no longer current (e.g. a pending
    // onopen firing after stop()/reconnect — React StrictMode double-mount).
    const isCurrent = () => !this.stopped && this.transport === t;
    t.onopen = () => {
      if (!isCurrent()) return;
      this.attempt = 0;
      this.startHeartbeat();
      this.setState("online");
      if (this.hadConnection) this.o.onReconnect?.();
      this.hadConnection = true;
    };
    t.onmessage = (data) => {
      if (!isCurrent()) return;
      this.handleMessage(data);
    };
    t.onclose = () => {
      if (this.transport !== t) return; // already replaced or stopped
      this.handleClose();
    };
    t.onerror = () => {
      /* a close event follows; reconnection is handled there */
    };
  }

  private handleMessage(data: string): void {
    const frame = decodeFrame(data);
    if (!frame) return;
    // Heartbeat echo is type 5 WITHOUT a msgUuid. A type-5 frame WITH a msgUuid is
    // a NEW_GROUP_SESSION push — the two wire enums collide on 5, so disambiguate
    // by msgUuid (not numeric type) or group-session pushes get dropped forever.
    if (frame.type === OUT.HEART_BEAT && !frame.msgUuid) return;

    // Drop duplicates up front, but still ACK so the server stops redelivering.
    if (frame.msgUuid && this.seen.has(frame.msgUuid)) {
      this.ack(frame);
      return;
    }

    // Hand to the cache FIRST; only THEN mark seen + ACK. If onPush throws, the
    // msgUuid stays un-remembered and un-ACK'd so the server's redelivery is
    // reprocessed (ADR 0002 §4: ACK only after the message is persisted locally).
    const event = frameToPushEvent(frame);
    if (event) this.o.onPush(event);
    if (frame.msgUuid) this.remember(frame.msgUuid);
    if (frameNeedsAck(frame)) this.ack(frame);
  }

  private ack(frame: WireFrame): void {
    if (!frame.msgUuid) return;
    this.transport?.send(encodeFrame({type: OUT.ACK, msgUuid: frame.msgUuid}));
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeat = setInterval(() => {
      this.transport?.send(encodeFrame({type: OUT.HEART_BEAT}));
    }, this.o.heartbeatMs);
  }

  private handleClose(): void {
    this.clearHeartbeat();
    this.transport = null;
    if (this.stopped) {
      this.setState("offline");
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.setState(this.hadConnection ? "reconnecting" : "connecting");
    const n = this.attempt++;
    const exp = Math.min(this.o.backoffBaseMs * 2 ** n, this.o.backoffCapMs);
    const delay = exp + Math.random() * exp * 0.3; // jitter
    if (this.reconnect) clearTimeout(this.reconnect);
    this.reconnect = setTimeout(() => this.open(), delay);
  }

  private remember(msgUuid: string): void {
    this.seen.add(msgUuid);
    this.seenOrder.push(msgUuid);
    if (this.seenOrder.length > this.o.dedupWindow) {
      const evicted = this.seenOrder.shift();
      if (evicted) this.seen.delete(evicted);
    }
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.o.onState(next);
  }

  private clearHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private clearTimers(): void {
    this.clearHeartbeat();
    if (this.reconnect) clearTimeout(this.reconnect);
    this.reconnect = null;
  }
}

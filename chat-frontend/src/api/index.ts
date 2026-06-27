// The single integration seam (一处切). `isMock` is driven by VITE_API_BASE
// (empty = Mock). The real branch (http.ts + real.ts: D4 envelope unwrap,
// Authorization Bearer, 401→refresh→replay, never sends userId) takes over when
// VITE_API_BASE is set. Default stays Mock so the UI is fully exercisable offline
// and CI build/verify:ui is backend-independent.
import type {Api} from "./contract";
import {mockApi} from "./mock";
import {realApi} from "./real";

export const isMock = !import.meta.env.VITE_API_BASE;

// P4: real branch wired for delivered endpoints (auth §7.1; sessions/history/
// friends/markRead; B8 WS). Not-yet-delivered methods inside realApi delegate to
// the mock (see real.ts). Set VITE_API_BASE to the gateway (or "1" to use the dev
// proxy) to run against the real backend.
export const api: Api = isMock ? mockApi : realApi;

export type {Api, SendResult, ListMessagesOptions} from "./contract";
export * from "./types";

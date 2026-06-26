// The single integration seam. `isMock` is driven by VITE_API_BASE (empty =
// Mock). The real branch (a typed HTTP client that unwraps the D4 envelope,
// injects Authorization, and never sends userId) replaces `mockApi` in P2.
import type {Api} from "./contract";
import {mockApi} from "./mock";

export const isMock = !import.meta.env.VITE_API_BASE;

// TODO(P2): when isMock is false, build the real Api over VITE_API_BASE (see
// ADR 0001 §契约消费). Until then we run on the mock so the UI is fully
// exercisable offline.
export const api: Api = mockApi;

export type {Api, SendResult, ListMessagesOptions} from "./contract";
export * from "./types";

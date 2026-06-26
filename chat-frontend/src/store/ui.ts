import type {ConnectionState} from "@infinitechat/design-system";
import {create} from "zustand";

// Lightweight client state (ADR 0001 §3.2): connection state + per-session draft.
// Server data lives in react-query; this is only ephemeral UI state.
interface UiState {
  connection: ConnectionState;
  setConnection: (c: ConnectionState) => void;

  drafts: Record<string, string>;
  setDraft: (sessionId: string, text: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  connection: "connecting",
  setConnection: (connection) => set({connection}),

  drafts: {},
  setDraft: (sessionId, text) =>
    set((s) => ({drafts: {...s.drafts, [sessionId]: text}})),
}));

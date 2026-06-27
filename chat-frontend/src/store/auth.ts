import {create} from "zustand";

import type {AuthSession} from "@/api/types";

const KEY = "lingxi.auth";

function load(): AuthSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function save(session: AuthSession | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

interface AuthState {
  session: AuthSession | null;
  signIn: (s: AuthSession) => void;
  signOut: () => void;
}

/**
 * Auth session state (D14). Restored from localStorage on load, so a refresh
 * keeps you signed in. The real flow only swaps the mock api behind the
 * sign-in mutations; this store and the gate stay the same.
 */
export const useAuthStore = create<AuthState>((set) => ({
  session: load(),
  signIn: (session) => {
    save(session);
    set({session});
  },
  signOut: () => {
    save(null);
    set({session: null});
  },
}));

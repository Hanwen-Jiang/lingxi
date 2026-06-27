// Auth state lives here so the api client and the React layer can subscribe to
// the same source of truth. Per docs/planning/03-contracts.md:
//   - the client NEVER sends X-User-Id / X-User-Roles (the gateway strips them
//     and only trusts headers it injects after JWT verify);
//   - JWT sub = string snowflake userId, roles claim carries roles;
//   - access TTL is short (15–30 min) and a refresh token flow is coming
//     (POST /api/v1/user/refresh — wired here but no-op until S3 ships it).
// Storage is keyed under `lingxi.auth.*` to namespace with the existing
// `lingxi.apiBase` / `lingxi.lastSessionId` keys. All access is try/catch so
// private-mode / disabled-storage degrades to in-memory only.

import {deleteStorage, readStorage, writeStorage} from "./storage";

export const AUTH_STORAGE_KEYS = {
  access: "lingxi.auth.access",
  refresh: "lingxi.auth.refresh",
  user: "lingxi.auth.user",
} as const;

export type AuthUser = {
  id: string;
  name?: string;
  avatar?: string;
  roles: string[];
};

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
};

type Listener = (state: AuthState) => void;

const listeners = new Set<Listener>();

function loadInitial(): AuthState {
  // Empty strings get treated as "no value" — earlier code wrote "" on clear,
  // which round-tripped to a truthy non-null read on next mount.
  const accessRaw = readStorage(AUTH_STORAGE_KEYS.access);
  const refreshRaw = readStorage(AUTH_STORAGE_KEYS.refresh);
  const access = accessRaw && accessRaw.length > 0 ? accessRaw : null;
  const refresh = refreshRaw && refreshRaw.length > 0 ? refreshRaw : null;
  const userRaw = readStorage(AUTH_STORAGE_KEYS.user);
  let user: AuthUser | null = null;
  if (userRaw && userRaw.length > 0) {
    try {
      const parsed = JSON.parse(userRaw) as AuthUser;
      if (parsed && typeof parsed.id === "string") user = parsed;
    } catch {
      // Ignore — corrupt cache, fall through to no user.
    }
  }
  // If we have a token but no parsed user, try to fall back to the sub claim.
  if (!user && access) {
    const claims = decodeJwt(access);
    if (claims?.sub) {
      user = {id: String(claims.sub), roles: parseRoles(claims)};
    }
  }
  return {accessToken: access, refreshToken: refresh, user};
}

let state: AuthState = loadInitial();

function persist(next: AuthState) {
  if (next.accessToken) writeStorage(AUTH_STORAGE_KEYS.access, next.accessToken);
  else deleteStorage(AUTH_STORAGE_KEYS.access);
  if (next.refreshToken) writeStorage(AUTH_STORAGE_KEYS.refresh, next.refreshToken);
  else deleteStorage(AUTH_STORAGE_KEYS.refresh);
  if (next.user) writeStorage(AUTH_STORAGE_KEYS.user, JSON.stringify(next.user));
  else deleteStorage(AUTH_STORAGE_KEYS.user);
}

function emit() {
  listeners.forEach((listener) => listener(state));
}

export const authStore = {
  get: () => state,
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setSession(next: {accessToken: string; refreshToken: string | null; user: AuthUser}) {
    state = {accessToken: next.accessToken, refreshToken: next.refreshToken, user: next.user};
    persist(state);
    emit();
  },
  clear() {
    state = {accessToken: null, refreshToken: null, user: null};
    persist(state);
    emit();
  },
};

type JwtClaims = {
  sub?: string;
  roles?: string | string[];
  exp?: number;
  iat?: number;
  iss?: string;
};

// Decode the JWT payload without verifying — verification is the gateway's
// job. We only read sub (= userId, per contract §7) and roles for the UI.
export function decodeJwt(token: string): JwtClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    if (!payload) return null;
    // base64url → base64
    const padded = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const binary = atob(padded);
    // Round-trip the binary string through Uint8Array so TextDecoder can do
    // proper UTF-8 decoding (atob alone produces Latin-1, which mangles any
    // non-ASCII bytes in the claims).
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder("utf-8").decode(bytes);
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

export function parseRoles(claims: JwtClaims | null | undefined): string[] {
  if (!claims) return [];
  const r = claims.roles;
  if (Array.isArray(r)) return r.map(String);
  if (typeof r === "string") {
    return r
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return !!user?.roles?.includes("admin");
}

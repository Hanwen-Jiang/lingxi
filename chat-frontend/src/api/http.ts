// Typed HTTP client for the real Api branch (03-contracts §1/§2/§3/§7). One place
// owns: base-URL resolution, Authorization injection (Bearer only — NEVER userId,
// the gateway injects X-User-Id), D4 envelope unwrap, HTTP-status→message mapping,
// and the 401→refresh→retry replay (D2). The real api (real.ts) is built on this.
import type {AuthSession} from "./types";
import {useAuthStore} from "@/store/auth";

// --- Base URL resolution -----------------------------------------------------
// VITE_API_BASE selects the real branch (non-empty) AND sets the origin:
//   • absolute (http(s)://host:port) → prepended to each path (CORS must allow it);
//   • anything else (e.g. "1", "/") → relative paths, served via the Vite dev proxy
//     (`/api` → gateway, ws:true) so there's no CORS in dev.
// Endpoint paths are the full gateway paths ("/api/v1/..."), so an absolute base is
// just an origin and a relative base is "" (paths used as-is).
const RAW = ((import.meta.env.VITE_API_BASE as string | undefined) ?? "").trim();
export const API_ABSOLUTE = /^https?:\/\//i.test(RAW);
export const API_ORIGIN = API_ABSOLUTE ? RAW.replace(/\/+$/, "") : "";

export function apiUrl(path: string): string {
  return API_ORIGIN + path;
}

/** ws(s):// origin for the B8 WebSocket handshake. Mirrors apiUrl's resolution:
 *  absolute base → swap http→ws; relative (proxy) → derive from the page origin. */
export function wsOrigin(): string {
  if (API_ABSOLUTE) return API_ORIGIN.replace(/^http/i, "ws");
  const loc = window.location;
  return `${loc.protocol === "https:" ? "wss:" : "ws:"}//${loc.host}`;
}

// --- Envelope + errors --------------------------------------------------------
interface Envelope<T> {
  code?: number;
  message?: string;
  data?: T;
  traceId?: string;
  timestamp?: number;
}

interface FieldError {
  field: string;
  message: string;
}

/** A request that failed by HTTP status or business code. `status` is the HTTP
 *  status (so the UI can branch on 401/403/422); `code` is the §3 business code
 *  when the body carried an envelope. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: number,
    public readonly traceId?: string,
    public readonly fieldErrors?: FieldError[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// code 0 = success (§2). We also accept legacy 200 for the not-yet-flipped
// endpoints (S3 item3 翻转前旧端点自有 Result),per the cross-stack {0,200} 兜底.
const SUCCESS_CODES = new Set([0, 200]);

/** User-facing message by HTTP status (§3). Gateway-level rejections (e.g. the
 *  401 for a missing token) come back with an EMPTY body, so we can't rely on the
 *  envelope message — map the status to copy the user understands. */
function statusMessage(status: number): string {
  switch (status) {
    case 400:
      return "请求有误,请检查后重试";
    case 401:
      return "登录已过期,请重新登录";
    case 403:
      return "没有权限进行此操作";
    case 404:
      return "请求的资源不存在";
    case 409:
      return "操作冲突,请刷新后重试";
    case 422:
      return "提交的内容有误,请检查";
    case 429:
      return "操作太频繁,请稍后再试";
    case 503:
      return "服务暂时不可用,请稍后再试";
    default:
      return status >= 500 ? "服务异常,请稍后再试" : "请求失败,请稍后重试";
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Attach `Authorization: Bearer <token>` (default true). Public auth endpoints pass false. */
  auth?: boolean;
  /** Allow one 401→refresh→retry (default true). The refresh call itself passes false. */
  retry?: boolean;
  signal?: AbortSignal;
}

async function rawFetch(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  if (opts.auth !== false) {
    const token = useAuthStore.getState().session?.token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return fetch(apiUrl(path), {method: opts.method ?? "GET", headers, body, signal: opts.signal});
}

/**
 * Issue a request and return the unwrapped `data`. Throws `ApiError` on HTTP
 * error or a non-success business code. On 401 (and when allowed) it refreshes
 * once and replays — so a short-lived access token is transparent to callers.
 */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await rawFetch(path, opts);

  if (res.status === 401 && opts.retry !== false && opts.auth !== false) {
    const ok = await tryRefresh();
    if (ok) res = await rawFetch(path, {...opts, retry: false});
  }

  // Body may be empty (gateway 401) or non-JSON — parse defensively.
  const text = await res.text();
  let env: Envelope<T> | null = null;
  if (text) {
    try {
      env = JSON.parse(text) as Envelope<T>;
    } catch {
      env = null;
    }
  }

  if (!res.ok) {
    const fieldErrors = (env?.data as {fieldErrors?: FieldError[]} | undefined)?.fieldErrors;
    throw new ApiError(
      res.status,
      env?.message || statusMessage(res.status),
      env?.code,
      env?.traceId ?? res.headers.get("X-Trace-Id") ?? undefined,
      fieldErrors,
    );
  }

  // 2xx with an envelope: a non-{0,200} code is still an error (defensive — the
  // contract maps errors to HTTP status, but tolerate a stray body-coded error).
  if (env && env.code !== undefined && !SUCCESS_CODES.has(env.code)) {
    throw new ApiError(res.status, env.message || "请求失败", env.code, env.traceId);
  }

  return (env ? (env.data as T) : (text ? (JSON.parse(text) as T) : (undefined as T)));
}

// --- Session mapping + refresh ------------------------------------------------
/** Raw LoginResponse (§7.1 · D14). All ids are string (D5). */
export interface LoginResponseRaw {
  userId: string;
  userName?: string;
  avatar?: string;
  token: string;
  refreshToken: string;
}

export function mapSession(r: LoginResponseRaw): AuthSession {
  return {
    userId: String(r.userId),
    userName: r.userName ?? "",
    avatar: r.avatar,
    token: r.token,
    refreshToken: r.refreshToken,
  };
}

// Coalesce concurrent 401s into a single in-flight refresh so a burst of parallel
// requests triggers exactly one POST /refresh (D2). Resolves true on success.
let refreshing: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  const store = useAuthStore.getState();
  const rt = store.session?.refreshToken;
  if (!rt) return Promise.resolve(false);

  refreshing = (async () => {
    try {
      const res = await rawFetch("/api/v1/user/refresh", {
        method: "POST",
        body: {refreshToken: rt},
        auth: false,
        retry: false,
      });
      if (!res.ok) {
        store.signOut();
        return false;
      }
      const text = await res.text();
      const env = text ? (JSON.parse(text) as Envelope<LoginResponseRaw>) : null;
      if (!env?.data || (env.code !== undefined && !SUCCESS_CODES.has(env.code))) {
        store.signOut();
        return false;
      }
      store.signIn(mapSession(env.data));
      return true;
    } catch {
      store.signOut();
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

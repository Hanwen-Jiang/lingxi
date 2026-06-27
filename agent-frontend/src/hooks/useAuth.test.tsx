import {act, renderHook} from "@testing-library/react";
import {describe, expect, it, vi, beforeEach} from "vitest";

import type {ApiClient} from "../api";
import {authStore} from "../lib/auth";
import type {LoginResponse} from "../types";
import {useAuth} from "./useAuth";

// Build a minimal JWT (sub + roles) so decodeJwt has something to parse.
function fakeJwt(claims: Record<string, unknown>): string {
  const enc = (s: string) =>
    btoa(unescape(encodeURIComponent(s)))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const header = enc(JSON.stringify({alg: "HS256", typ: "JWT"}));
  const payload = enc(JSON.stringify(claims));
  return `${header}.${payload}.sig`;
}

function makeResponse(overrides: Partial<LoginResponse> = {}): LoginResponse {
  return {
    userId: "100000000000000001",
    userName: "灵犀dev",
    token: fakeJwt({sub: "100000000000000001", roles: "user", exp: 9999999999}),
    refreshToken: "refresh-token-1",
    ...overrides,
  };
}

function makeApi(over: Partial<ApiClient> = {}): ApiClient {
  return {
    login: vi.fn(async () => makeResponse()),
    loginCode: vi.fn(async () => makeResponse({userName: "code-user"})),
    register: vi.fn(async () => makeResponse({userName: "new-user", userId: "200000000000000002"})),
    sendMail: vi.fn(async () => ({status: "ok"})),
    refresh: vi.fn(async () => makeResponse()),
    ...over,
  } as unknown as ApiClient;
}

describe("useAuth · D14 email model", () => {
  beforeEach(() => {
    authStore.clear();
  });

  it("loginPassword stores token + user (with sub-fallback when userId null)", async () => {
    const api = makeApi({
      login: vi.fn(async () => makeResponse({userId: null})),
    });
    const {result} = renderHook(() => useAuth(api));
    await act(async () => {
      await result.current.loginPassword({email: "a@b.com", password: "pw"});
    });
    expect(api.login).toHaveBeenCalledWith({email: "a@b.com", password: "pw"});
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.id).toBe("100000000000000001"); // from sub
  });

  it("loginCode posts {email, code} and establishes the session", async () => {
    const api = makeApi();
    const {result} = renderHook(() => useAuth(api));
    await act(async () => {
      await result.current.loginCode({email: "a@b.com", code: "123456"});
    });
    expect(api.loginCode).toHaveBeenCalledWith({email: "a@b.com", code: "123456"});
    expect(result.current.user?.name).toBe("code-user");
    expect(result.current.accessToken).toBeTruthy();
  });

  it("register posts {email, password, code} and auto-logs the new user in", async () => {
    const api = makeApi();
    const {result} = renderHook(() => useAuth(api));
    await act(async () => {
      await result.current.register({email: "new@b.com", password: "pw", code: "654321"});
    });
    expect(api.register).toHaveBeenCalledWith({email: "new@b.com", password: "pw", code: "654321"});
    expect(result.current.user?.id).toBe("200000000000000002");
  });

  it("sendMail posts {email} without touching the session", async () => {
    const api = makeApi();
    const {result} = renderHook(() => useAuth(api));
    await act(async () => {
      await result.current.sendMail("a@b.com");
    });
    expect(api.sendMail).toHaveBeenCalledWith({email: "a@b.com"});
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("logout clears the session", async () => {
    const api = makeApi();
    const {result} = renderHook(() => useAuth(api));
    await act(async () => {
      await result.current.loginPassword({email: "a@b.com", password: "pw"});
    });
    expect(result.current.isAuthenticated).toBe(true);
    act(() => result.current.logout());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.accessToken).toBeNull();
  });

  it("rejects responses missing a token", async () => {
    const api = makeApi({
      login: vi.fn(async () => ({userId: "1", token: ""}) as unknown as LoginResponse),
    });
    const {result} = renderHook(() => useAuth(api));
    await expect(
      act(async () => {
        await result.current.loginPassword({email: "a@b.com", password: "pw"});
      }),
    ).rejects.toThrowError();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

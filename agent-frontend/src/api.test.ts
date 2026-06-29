import {afterEach, describe, expect, it, vi} from "vitest";

import {ApiError, createApiClient, parseSsePayload} from "./api";
import type {ChatSessionSummary} from "./types";

type MockResponseInit = {
  ok: boolean;
  status: number;
  json?: unknown;
  text?: string;
  contentType?: string;
};

function mockResponse({ok, status, json, text = "", contentType = "application/json"}: MockResponseInit) {
  return {
    ok,
    status,
    headers: {get: () => contentType},
    json: async () => json,
    text: async () => text,
  };
}

const session: ChatSessionSummary = {
  userId: "1",
  sessionId: "42",
  title: "First conversation",
  mode: "auto",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createApiClient.listSessions", () => {
  it("returns data when the envelope has code 200", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ok: true, status: 200, json: {code: 200, data: [session], message: "ok"}}));
    vi.stubGlobal("fetch", fetchMock);

    const api = createApiClient("/api");
    const result = await api.listSessions("1");

    expect(result).toEqual([session]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/chat/sessions");
  });

  it("throws ApiError when the envelope code is not 200", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ok: true, status: 200, json: {code: 500, data: null, message: "boom"}}));
    vi.stubGlobal("fetch", fetchMock);

    const api = createApiClient("/api");

    await expect(api.listSessions("1")).rejects.toBeInstanceOf(ApiError);
    await expect(api.listSessions("1")).rejects.toMatchObject({code: 500, message: "boom"});
  });

  it("throws ApiError when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ok: false, status: 503, json: {message: "unavailable"}}));
    vi.stubGlobal("fetch", fetchMock);

    const api = createApiClient("/api");

    await expect(api.listSessions("1")).rejects.toBeInstanceOf(ApiError);
    await expect(api.listSessions("1")).rejects.toMatchObject({status: 503, message: "unavailable"});
  });

  it("accepts the contract envelope where success code is 0", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ok: true, status: 200, json: {code: 0, data: [session], message: "ok"}}));
    vi.stubGlobal("fetch", fetchMock);

    const api = createApiClient("/api");
    const result = await api.listSessions("1");
    expect(result).toEqual([session]);
  });
});

describe("createApiClient auth wiring", () => {
  it("injects Authorization: Bearer when getAccessToken returns a token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ok: true, status: 200, json: {code: 0, data: [], message: "ok"}}));
    vi.stubGlobal("fetch", fetchMock);

    const api = createApiClient("/api", {getAccessToken: () => "abc.def.ghi"});
    await api.listSessions("1");

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer abc.def.ghi");
  });

  it("omits Authorization when there is no token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ok: true, status: 200, json: {code: 0, data: [], message: "ok"}}));
    vi.stubGlobal("fetch", fetchMock);

    const api = createApiClient("/api", {getAccessToken: () => null});
    await api.listSessions("1");

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("triggers onUnauthorized on HTTP 401 and throws ApiError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ok: false, status: 401, json: {message: "expired"}}));
    vi.stubGlobal("fetch", fetchMock);
    const onUnauthorized = vi.fn();

    const api = createApiClient("/api", {onUnauthorized});

    await expect(api.listSessions("1")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("triggers onUnauthorized on body code 40100 even when HTTP is 200", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ok: true, status: 200, json: {code: 40100, data: null, message: "expired"}}));
    vi.stubGlobal("fetch", fetchMock);
    const onUnauthorized = vi.fn();

    const api = createApiClient("/api", {onUnauthorized});

    await expect(api.listSessions("1")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe("createApiClient refresh-on-401 pipeline", () => {
  it("retries the original request after a successful /refresh", async () => {
    // Token store the test owns so the second fetch sees the rotated token.
    let access = "stale.token";
    const fetchMock = vi
      .fn()
      // 1) original request → 401
      .mockResolvedValueOnce(mockResponse({ok: false, status: 401, json: {message: "expired"}}))
      // 2) /refresh → fresh LoginResponse
      .mockResolvedValueOnce(
        mockResponse({
          ok: true,
          status: 200,
          json: {code: 0, data: {userId: "1", token: "fresh.token", refreshToken: "fresh.refresh"}, message: "ok"},
        }),
      )
      // 3) original request retried → success
      .mockResolvedValueOnce(mockResponse({ok: true, status: 200, json: {code: 0, data: [session], message: "ok"}}));
    vi.stubGlobal("fetch", fetchMock);

    const onRefreshed = vi.fn((res: {token: string; refreshToken?: string}) => {
      access = res.token;
    });
    const onUnauthorized = vi.fn();

    const api = createApiClient("/api", {
      getAccessToken: () => access,
      getRefreshToken: () => "the.refresh.token",
      onRefreshed,
      onUnauthorized,
    });

    const result = await api.listSessions("1");

    expect(result).toEqual([session]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain("/v1/user/refresh");
    expect(onRefreshed).toHaveBeenCalledTimes(1);
    expect(onRefreshed.mock.calls[0][0]).toMatchObject({token: "fresh.token", refreshToken: "fresh.refresh"});
    // Retry must carry the rotated bearer.
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe("Bearer fresh.token");
    // No final unauthorized — refresh+retry resolved it.
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("falls back to onUnauthorized when /refresh itself fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ok: false, status: 401, json: {message: "expired"}}))
      .mockResolvedValueOnce(mockResponse({ok: false, status: 401, json: {message: "refresh expired"}}));
    vi.stubGlobal("fetch", fetchMock);
    const onRefreshed = vi.fn();
    const onUnauthorized = vi.fn();

    const api = createApiClient("/api", {
      getRefreshToken: () => "the.refresh.token",
      onRefreshed,
      onUnauthorized,
    });

    await expect(api.listSessions("1")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2); // original + refresh; no retry
    expect(onRefreshed).not.toHaveBeenCalled();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("skips /refresh entirely when no refresh token is available", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ok: false, status: 401, json: {message: "expired"}}));
    vi.stubGlobal("fetch", fetchMock);
    const onUnauthorized = vi.fn();

    const api = createApiClient("/api", {
      getRefreshToken: () => null,
      onUnauthorized,
    });

    await expect(api.listSessions("1")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("collapses concurrent 401s into a single /refresh call (in-flight dedup)", async () => {
    // Two parallel callers both 401; we expect ONE /refresh round-trip, then
    // two retries that both succeed with the rotated token.
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/v1/user/refresh")) {
        return mockResponse({
          ok: true,
          status: 200,
          json: {code: 0, data: {userId: "1", token: "fresh.token"}, message: "ok"},
        });
      }
      // First two calls (before retry) 401; subsequent retries 200.
      const callIndex = fetchMock.mock.calls.length;
      if (callIndex <= 2) return mockResponse({ok: false, status: 401, json: {message: "expired"}});
      return mockResponse({ok: true, status: 200, json: {code: 0, data: [session], message: "ok"}});
    });
    vi.stubGlobal("fetch", fetchMock);

    const onRefreshed = vi.fn();
    let access = "stale";
    const api = createApiClient("/api", {
      getAccessToken: () => access,
      getRefreshToken: () => "rt",
      onRefreshed: (res) => {
        access = res.token;
        onRefreshed(res);
      },
    });

    const [a, b] = await Promise.all([api.listSessions("1"), api.listSessions("1")]);
    expect(a).toEqual([session]);
    expect(b).toEqual([session]);

    // /refresh was called exactly once despite two concurrent 401s.
    const refreshCalls = fetchMock.mock.calls.filter((c: unknown[]) => String(c[0]).includes("/v1/user/refresh"));
    expect(refreshCalls.length).toBe(1);
    expect(onRefreshed).toHaveBeenCalledTimes(1);
  });

  it("does not loop when the retried request 401s again", async () => {
    const fetchMock = vi
      .fn()
      // first attempt 401
      .mockResolvedValueOnce(mockResponse({ok: false, status: 401, json: {message: "expired"}}))
      // /refresh succeeds
      .mockResolvedValueOnce(
        mockResponse({
          ok: true,
          status: 200,
          json: {code: 0, data: {userId: "1", token: "fresh.token"}, message: "ok"},
        }),
      )
      // retry STILL 401 (token rejected by gateway for some other reason)
      .mockResolvedValueOnce(mockResponse({ok: false, status: 401, json: {message: "still expired"}}));
    vi.stubGlobal("fetch", fetchMock);

    const onUnauthorized = vi.fn();
    const api = createApiClient("/api", {
      getRefreshToken: () => "rt",
      onRefreshed: vi.fn(),
      onUnauthorized,
    });

    await expect(api.listSessions("1")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(3); // original + refresh + ONE retry
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

// SSE §9 (03-contracts.md). The frame envelope is {type, ...} JSON; the
// parser must surface v / buffered / unknown-type fields unchanged so the
// hook can decide what to do with them.
describe("parseSsePayload — SSE §9 envelope", () => {
  it("preserves v and buffered fields when present", () => {
    const chunk = `data: ${JSON.stringify({type: "delta", v: "1", buffered: true, text: "hi"})}\n\n`;
    const {events, tail} = parseSsePayload(chunk);
    expect(tail).toBe("");
    expect(events).toEqual([{type: "delta", v: "1", buffered: true, text: "hi"}]);
  });

  it("passes through unknown event types without translating them to delta", () => {
    // Forward-compat: backend may add tool_call / citation_delta / etc.;
    // the parser must surface the raw event so the hook can ignore it
    // explicitly. Coercing to delta would corrupt the assistant content.
    const chunk = `data: ${JSON.stringify({type: "tool_call", v: "1", name: "x"})}\n\n`;
    const {events} = parseSsePayload(chunk);
    expect(events).toEqual([{type: "tool_call", v: "1", name: "x"}]);
  });

  it("falls back to a synthetic delta only for unparseable payloads", () => {
    // Defensive: a bare non-JSON line (e.g. a raw token) keeps the assistant
    // bubble rendering rather than killing the stream. This is intentionally
    // distinct from the unknown-type case above.
    const chunk = "data: raw-token\n\n";
    const {events} = parseSsePayload(chunk);
    expect(events).toEqual([{type: "delta", text: "raw-token"}]);
  });
});

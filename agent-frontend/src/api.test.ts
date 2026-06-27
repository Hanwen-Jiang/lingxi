import {afterEach, describe, expect, it, vi} from "vitest";

import {ApiError, createApiClient} from "./api";
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
  userId: 1,
  sessionId: 42,
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
    const result = await api.listSessions(1);

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

    await expect(api.listSessions(1)).rejects.toBeInstanceOf(ApiError);
    await expect(api.listSessions(1)).rejects.toMatchObject({code: 500, message: "boom"});
  });

  it("throws ApiError when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ok: false, status: 503, json: {message: "unavailable"}}));
    vi.stubGlobal("fetch", fetchMock);

    const api = createApiClient("/api");

    await expect(api.listSessions(1)).rejects.toBeInstanceOf(ApiError);
    await expect(api.listSessions(1)).rejects.toMatchObject({status: 503, message: "unavailable"});
  });

  it("accepts the contract envelope where success code is 0", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ok: true, status: 200, json: {code: 0, data: [session], message: "ok"}}));
    vi.stubGlobal("fetch", fetchMock);

    const api = createApiClient("/api");
    const result = await api.listSessions(1);
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
    await api.listSessions(1);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer abc.def.ghi");
  });

  it("omits Authorization when there is no token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ok: true, status: 200, json: {code: 0, data: [], message: "ok"}}));
    vi.stubGlobal("fetch", fetchMock);

    const api = createApiClient("/api", {getAccessToken: () => null});
    await api.listSessions(1);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("triggers onUnauthorized on HTTP 401 and throws ApiError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ok: false, status: 401, json: {message: "expired"}}));
    vi.stubGlobal("fetch", fetchMock);
    const onUnauthorized = vi.fn();

    const api = createApiClient("/api", {onUnauthorized});

    await expect(api.listSessions(1)).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("triggers onUnauthorized on body code 40100 even when HTTP is 200", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ok: true, status: 200, json: {code: 40100, data: null, message: "expired"}}));
    vi.stubGlobal("fetch", fetchMock);
    const onUnauthorized = vi.fn();

    const api = createApiClient("/api", {onUnauthorized});

    await expect(api.listSessions(1)).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

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
});

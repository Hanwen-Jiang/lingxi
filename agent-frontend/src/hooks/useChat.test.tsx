import {act, renderHook, waitFor} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import type {ApiClient} from "../api";
import type {StreamChatEvent} from "../types";
import {useChat} from "./useChat";

function makeApi(): ApiClient {
  const autoStreamChat = vi.fn(async (_payload: unknown, onEvent: (event: StreamChatEvent) => void) => {
    onEvent({type: "delta", text: "hi"});
  });

  // Only autoStreamChat is exercised by useChat.sendPrompt; the rest of the
  // ApiClient surface is irrelevant to this hook, so we cast a partial mock.
  return {autoStreamChat} as unknown as ApiClient;
}

describe("useChat.sendPrompt", () => {
  it("appends optimistic + assistant messages and streams the delta into the answer", async () => {
    vi.useFakeTimers();
    const api = makeApi();
    const onSettled = vi.fn();

    const {result} = renderHook(() => useChat({api, userId: 1, sessionId: 1, onSettled}));

    act(() => {
      result.current.setPrompt("hello there");
    });

    await act(async () => {
      await result.current.sendPrompt();
    });

    const {messages} = result.current;
    expect(messages).toHaveLength(2);

    const userMessage = messages.find((message) => message.role === "user");
    const assistantMessage = messages.find((message) => message.role === "assistant");

    expect(userMessage?.content).toBe("hello there");
    expect(assistantMessage?.content).toContain("hi");
    expect(assistantMessage?.status).toBe("complete");
    expect(result.current.status).toBe("ready");

    // onSettled is scheduled 500ms after the stream settles.
    expect(onSettled).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onSettled).toHaveBeenCalledWith(1);

    vi.useRealTimers();
  });

  it("clears the prompt and exposes stopStream", async () => {
    const api = makeApi();
    const {result} = renderHook(() => useChat({api, userId: 1, sessionId: 1, onSettled: vi.fn()}));

    act(() => {
      result.current.setPrompt("ask something");
    });

    await act(async () => {
      await result.current.sendPrompt();
    });

    await waitFor(() => expect(result.current.prompt).toBe(""));
    expect(typeof result.current.stopStream).toBe("function");
  });
});

// M3 — non-auto modes dispatch to distinct backend endpoints and answer in a
// single (non-streamed) frame. Each mock returns that endpoint's DTO shape.
function makeRoutingApi() {
  return {
    autoStreamChat: vi.fn(async (_payload: unknown, onEvent: (event: StreamChatEvent) => void) => {
      onEvent({type: "delta", text: "stream"});
    }),
    chat: vi.fn(async () => ({sessionId: 1, answer: "direct-answer"})),
    agentChat: vi.fn(async () => ({answer: "agent-answer", strategy: "react", reactTrace: [{step: 1}]})),
    ragChat: vi.fn(async () => ({answer: "rag-answer", hit: true, citations: [{index: 0, snippet: "doc"}]})),
    adaptiveRagChat: vi.fn(async () => ({answer: "adaptive-answer", strategy: "multi-hop", rounds: 2})),
  } as unknown as ApiClient & Record<string, ReturnType<typeof vi.fn>>;
}

describe("useChat.sendPrompt · mode routing (M3)", () => {
  const cases = [
    {mode: "direct", method: "chat", answer: "direct-answer"},
    {mode: "agent", method: "agentChat", answer: "agent-answer"},
    {mode: "rag", method: "ragChat", answer: "rag-answer"},
    {mode: "adaptive-rag", method: "adaptiveRagChat", answer: "adaptive-answer"},
    {mode: "draft", method: "chat", answer: "direct-answer"},
  ] as const;

  it.each(cases)("routes $mode to $method and renders one complete frame", async ({mode, method, answer}) => {
    const api = makeRoutingApi();
    const {result} = renderHook(() => useChat({api, userId: 1, sessionId: 1, mode, onSettled: vi.fn()}));

    act(() => {
      result.current.setPrompt("question");
    });
    await act(async () => {
      await result.current.sendPrompt();
    });

    // The selected endpoint is hit exactly once; streaming never engages.
    expect(api[method]).toHaveBeenCalledTimes(1);
    expect(api.autoStreamChat).not.toHaveBeenCalled();

    const assistant = result.current.messages.find((message) => message.role === "assistant");
    expect(assistant?.content).toBe(answer);
    expect(assistant?.status).toBe("complete");
    expect(assistant?.modeId).toBe(mode);
    expect(result.current.status).toBe("ready");
    // An explicit mode is a forced route so the composer reflects the choice.
    expect(result.current.lastRouteResult?.forced).toBe(true);
  });

  it("attaches citations and a tool trace for the agent/rag modes", async () => {
    const api = makeRoutingApi();
    const rag = renderHook(() => useChat({api, userId: 1, sessionId: 1, mode: "rag", onSettled: vi.fn()}));
    act(() => rag.result.current.setPrompt("q"));
    await act(async () => {
      await rag.result.current.sendPrompt();
    });
    const ragAssistant = rag.result.current.messages.find((message) => message.role === "assistant");
    expect(ragAssistant?.citations?.[0]?.snippet).toBe("doc");

    const agent = renderHook(() => useChat({api, userId: 1, sessionId: 1, mode: "agent", onSettled: vi.fn()}));
    act(() => agent.result.current.setPrompt("q"));
    await act(async () => {
      await agent.result.current.sendPrompt();
    });
    const agentAssistant = agent.result.current.messages.find((message) => message.role === "assistant");
    expect(agentAssistant?.meta?.toolTrace).toEqual([{step: 1}]);
    expect(agentAssistant?.meta?.route).toBe("agent");
  });

  it("surfaces a friendly error frame when a sync endpoint throws", async () => {
    const api = {
      autoStreamChat: vi.fn(),
      ragChat: vi.fn(async () => {
        throw new Error("boom");
      }),
    } as unknown as ApiClient;
    const {result} = renderHook(() => useChat({api, userId: 1, sessionId: 1, mode: "rag", onSettled: vi.fn()}));
    act(() => result.current.setPrompt("q"));
    await act(async () => {
      await result.current.sendPrompt();
    });
    const assistant = result.current.messages.find((message) => message.role === "assistant");
    expect(assistant?.status).toBe("error");
    expect(result.current.status).toBe("error");
  });
});

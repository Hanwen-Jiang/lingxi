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

    const {result} = renderHook(() => useChat({api, userId: "1", sessionId: "1", onSettled}));

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
    expect(onSettled).toHaveBeenCalledWith("1");

    vi.useRealTimers();
  });

  it("clears the prompt and exposes stopStream", async () => {
    const api = makeApi();
    const {result} = renderHook(() => useChat({api, userId: "1", sessionId: "1", onSettled: vi.fn()}));

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

// SSE §9 (03-contracts.md, live since S1 P5): wire envelope is {type, ...}
// with `v` (schema version) and `buffered:true` on routes that send a single
// frame. Older clients must tolerate unknown `type` values silently so the
// backend can add event kinds without coordinated client rollouts.
describe("useChat — SSE §9 schema conformance", () => {
  it("tolerates unknown event types without throwing or polluting the assistant bubble", async () => {
    // Send an event sequence that mixes a known delta with two events the
    // current client doesn't recognize (a forward-compat tool_call frame and
    // a future citation frame). The hook must skip them silently and still
    // render the known text.
    const autoStreamChat = vi.fn(async (_payload: unknown, onEvent: (event: StreamChatEvent) => void) => {
      onEvent({type: "start", v: "1", requestId: "req-1", route: "direct", forced: false});
      onEvent({type: "tool_call", v: "1"} as StreamChatEvent);
      onEvent({type: "delta", v: "1", text: "hello "});
      onEvent({type: "citation_delta", v: "1"} as StreamChatEvent);
      onEvent({type: "delta", v: "1", text: "world"});
      onEvent({type: "done", v: "1"});
    });
    const api = {autoStreamChat} as unknown as ApiClient;

    const {result} = renderHook(() => useChat({api, userId: "1", sessionId: "1", onSettled: vi.fn()}));
    act(() => result.current.setPrompt("hi"));
    await act(async () => {
      await result.current.sendPrompt();
    });

    const assistant = result.current.messages.find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("hello world");
    expect(assistant?.status).toBe("complete");
    expect(result.current.status).toBe("ready");
  });

  it("accepts a buffered:true single-frame stream as a normal complete answer", async () => {
    // agent / adaptive-RAG routes mark `buffered:true` to flag "the whole
    // answer arrives in one delta" — useChat must treat that exactly like
    // a multi-frame stream and finalize the bubble at done.
    const autoStreamChat = vi.fn(async (_payload: unknown, onEvent: (event: StreamChatEvent) => void) => {
      onEvent({type: "start", v: "1", requestId: "req-1", route: "agent", forced: true, buffered: true});
      onEvent({type: "delta", v: "1", text: "全部答案一帧到位。", buffered: true});
      onEvent({type: "done", v: "1", buffered: true});
    });
    const api = {autoStreamChat} as unknown as ApiClient;

    const {result} = renderHook(() => useChat({api, userId: "1", sessionId: "1", onSettled: vi.fn()}));
    act(() => result.current.setPrompt("ask agent"));
    await act(async () => {
      await result.current.sendPrompt();
    });

    const assistant = result.current.messages.find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("全部答案一帧到位。");
    expect(assistant?.status).toBe("complete");
    expect(assistant?.requestId).toBe("req-1");
  });
});

// M3 — non-auto modes dispatch to distinct backend endpoints and answer in a
// single (non-streamed) frame. Each mock returns that endpoint's DTO shape.
function makeRoutingApi() {
  return {
    autoStreamChat: vi.fn(async (_payload: unknown, onEvent: (event: StreamChatEvent) => void) => {
      onEvent({type: "delta", text: "stream"});
    }),
    chat: vi.fn(async () => ({sessionId: "1", answer: "direct-answer"})),
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
    const {result} = renderHook(() => useChat({api, userId: "1", sessionId: "1", mode, onSettled: vi.fn()}));

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
    const rag = renderHook(() => useChat({api, userId: "1", sessionId: "1", mode: "rag", onSettled: vi.fn()}));
    act(() => rag.result.current.setPrompt("q"));
    await act(async () => {
      await rag.result.current.sendPrompt();
    });
    const ragAssistant = rag.result.current.messages.find((message) => message.role === "assistant");
    expect(ragAssistant?.citations?.[0]?.snippet).toBe("doc");

    const agent = renderHook(() => useChat({api, userId: "1", sessionId: "1", mode: "agent", onSettled: vi.fn()}));
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
    const {result} = renderHook(() => useChat({api, userId: "1", sessionId: "1", mode: "rag", onSettled: vi.fn()}));
    act(() => result.current.setPrompt("q"));
    await act(async () => {
      await result.current.sendPrompt();
    });
    const assistant = result.current.messages.find((message) => message.role === "assistant");
    expect(assistant?.status).toBe("error");
    expect(result.current.status).toBe("error");
  });
});

// M4 / F01 — agent turns can be held by a server-issued challengeToken;
// confirmTurn echoes the token back in `confirmationToken` to release them.
// The legacy `confirmedTools[]` field is gone (S1 ignores it).
describe("useChat.confirmTurn (M4 / F01)", () => {
  it("surfaces the held turn then releases it by echoing the challengeToken", async () => {
    const agentChat = vi
      .fn()
      .mockResolvedValueOnce({
        answer: "需要确认工具",
        toolGovernance: {
          confirmationRequired: true,
          challengeToken: "chal-abc-1",
          challengeExpiresInSec: 60,
          pendingTools: [{name: "web_search", description: "搜索网络"}, {name: "delete_file"}],
        },
      })
      .mockResolvedValueOnce({answer: "搜索完成", strategy: "react"});
    const api = {autoStreamChat: vi.fn(), agentChat} as unknown as ApiClient;

    const {result} = renderHook(() => useChat({api, userId: "1", sessionId: "1", mode: "agent", onSettled: vi.fn()}));
    act(() => result.current.setPrompt("查一下天气"));
    await act(async () => {
      await result.current.sendPrompt();
    });

    let assistant = result.current.messages.find((message) => message.role === "assistant");
    // pendingTools is informational; the decisive signal is the challenge token on meta.
    expect(assistant?.meta?.pendingTools).toHaveLength(2);
    expect((assistant?.meta?.challenge as {challengeToken: string}).challengeToken).toBe("chal-abc-1");
    expect(assistant?.status).toBe("complete");
    const assistantId = assistant!.id;

    await act(async () => {
      await result.current.confirmTurn(assistantId, true);
    });

    expect(agentChat).toHaveBeenCalledTimes(2);
    // Replay sends confirmationToken, NOT confirmedTools[] (F01 ignores names).
    expect(agentChat).toHaveBeenLastCalledWith(
      expect.objectContaining({confirmationToken: "chal-abc-1", prompt: "查一下天气"}),
    );
    expect(agentChat.mock.calls[1][0]).not.toHaveProperty("confirmedTools");
    assistant = result.current.messages.find((message) => message.role === "assistant");
    expect(assistant?.content).toBe("搜索完成");
    expect(assistant?.meta?.confirmationApplied).toBe(true);
    expect(assistant?.meta?.challenge).toBeUndefined();
    expect(result.current.status).toBe("ready");
  });

  it("multi-round governance: a follow-up challenge re-stashes the new token", async () => {
    const agentChat = vi
      .fn()
      .mockResolvedValueOnce({
        answer: "round 1",
        toolGovernance: {confirmationRequired: true, challengeToken: "tok-1", pendingTools: [{name: "a"}]},
      })
      .mockResolvedValueOnce({
        answer: "round 2",
        toolGovernance: {confirmationRequired: true, challengeToken: "tok-2", pendingTools: [{name: "b"}]},
      })
      .mockResolvedValueOnce({answer: "all done"});
    const api = {autoStreamChat: vi.fn(), agentChat} as unknown as ApiClient;
    const {result} = renderHook(() => useChat({api, userId: "1", sessionId: "1", mode: "agent", onSettled: vi.fn()}));
    act(() => result.current.setPrompt("go"));
    await act(async () => {
      await result.current.sendPrompt();
    });
    const id = result.current.messages.find((m) => m.role === "assistant")!.id;

    // Release round 1 with tok-1 → server hands back tok-2.
    await act(async () => {
      await result.current.confirmTurn(id, true);
    });
    expect(agentChat).toHaveBeenLastCalledWith(expect.objectContaining({confirmationToken: "tok-1"}));
    let assistant = result.current.messages.find((m) => m.role === "assistant");
    expect((assistant?.meta?.challenge as {challengeToken: string}).challengeToken).toBe("tok-2");

    // Release round 2 with tok-2 → final answer, no further challenge.
    await act(async () => {
      await result.current.confirmTurn(id, true);
    });
    expect(agentChat).toHaveBeenLastCalledWith(expect.objectContaining({confirmationToken: "tok-2"}));
    assistant = result.current.messages.find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("all done");
    expect(assistant?.meta?.challenge).toBeUndefined();
  });

  it("ignores a toolGovernance blob with no challengeToken (F01 contract)", async () => {
    // pendingTools without a token used to spawn a confirmation card under the
    // legacy confirmedTools[] flow; under F01 there is nothing to release, so
    // we must NOT stash anything and the UI should treat the turn as complete.
    const agentChat = vi
      .fn()
      .mockResolvedValueOnce({answer: "no challenge", toolGovernance: {pendingTools: [{name: "a"}]}});
    const api = {autoStreamChat: vi.fn(), agentChat} as unknown as ApiClient;
    const {result} = renderHook(() => useChat({api, userId: "1", sessionId: "1", mode: "agent", onSettled: vi.fn()}));
    act(() => result.current.setPrompt("go"));
    await act(async () => {
      await result.current.sendPrompt();
    });
    const assistant = result.current.messages.find((m) => m.role === "assistant");
    expect(assistant?.meta?.challenge).toBeUndefined();
    expect(assistant?.meta?.pendingTools).toBeUndefined();

    // confirmTurn must be a no-op — nothing was stashed.
    await act(async () => {
      await result.current.confirmTurn(assistant!.id, true);
    });
    expect(agentChat).toHaveBeenCalledTimes(1); // no replay
  });

  it("cancel path drops the pending token without calling agentChat again", async () => {
    const agentChat = vi.fn().mockResolvedValueOnce({
      answer: "需要确认工具",
      toolGovernance: {confirmationRequired: true, challengeToken: "cancel-me", pendingTools: [{name: "x"}]},
    });
    const api = {autoStreamChat: vi.fn(), agentChat} as unknown as ApiClient;
    const {result} = renderHook(() => useChat({api, userId: "1", sessionId: "1", mode: "agent", onSettled: vi.fn()}));
    act(() => result.current.setPrompt("ask"));
    await act(async () => {
      await result.current.sendPrompt();
    });
    const id = result.current.messages.find((m) => m.role === "assistant")!.id;

    await act(async () => {
      await result.current.confirmTurn(id, false);
    });
    expect(agentChat).toHaveBeenCalledTimes(1); // no second call
    const assistant = result.current.messages.find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("已取消工具调用。");
    expect(assistant?.meta?.confirmationCancelled).toBe(true);
  });

  it("is a no-op when no turn is awaiting confirmation", async () => {
    const api = {autoStreamChat: vi.fn(), agentChat: vi.fn()} as unknown as ApiClient;
    const {result} = renderHook(() => useChat({api, userId: "1", sessionId: "1", mode: "agent", onSettled: vi.fn()}));
    await act(async () => {
      await result.current.confirmTurn("missing", true);
    });
    expect(api.agentChat as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });
});

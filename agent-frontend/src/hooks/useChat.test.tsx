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

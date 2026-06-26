import {describe, expect, it} from "vitest";

import {parseSsePayload} from "../api";

describe("parseSsePayload", () => {
  it("collects events from complete data: blocks", () => {
    const chunk = 'data: {"type":"delta","text":"hello"}\n\ndata: {"type":"delta","text":" world"}\n\n';
    const {events} = parseSsePayload(chunk);

    expect(events).toEqual([
      {type: "delta", text: "hello"},
      {type: "delta", text: " world"},
    ]);
  });

  it("parses JSON event payloads into typed events", () => {
    const chunk = 'data: {"type":"start","requestId":"req-1","route":"agent"}\n\n';
    const {events} = parseSsePayload(chunk);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({type: "start", requestId: "req-1", route: "agent"});
  });

  it("skips the [DONE] sentinel", () => {
    const chunk = 'data: {"type":"delta","text":"hi"}\n\ndata: [DONE]\n\n';
    const {events} = parseSsePayload(chunk);

    expect(events).toEqual([{type: "delta", text: "hi"}]);
  });

  it("falls back to a delta event for non-JSON payloads", () => {
    const chunk = "data: plain text token\n\n";
    const {events} = parseSsePayload(chunk);

    expect(events).toEqual([{type: "delta", text: "plain text token"}]);
  });

  it("returns an incomplete trailing block as the tail for the caller to re-buffer", () => {
    const chunk = 'data: {"type":"delta","text":"done"}\n\ndata: {"type":"delta","text":"par';
    const {events, tail} = parseSsePayload(chunk);

    // The first, complete block parses cleanly.
    expect(events[0]).toEqual({type: "delta", text: "done"});
    // The trailing partial block is handed back verbatim so the streaming
    // reader can prepend it to the next chunk before re-parsing.
    expect(tail).toBe('data: {"type":"delta","text":"par');
  });

  it("leaves no tail when the chunk ends on a block boundary", () => {
    const chunk = 'data: {"type":"delta","text":"done"}\n\n';
    const {tail} = parseSsePayload(chunk);

    expect(tail).toBe("");
  });

  it("ignores blocks without any data: lines", () => {
    const chunk = ': keep-alive comment\n\ndata: {"type":"delta","text":"x"}\n\n';
    const {events} = parseSsePayload(chunk);

    expect(events).toEqual([{type: "delta", text: "x"}]);
  });
});

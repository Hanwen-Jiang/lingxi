// §9 SSE parsing for the in-IM 灵犀 assistant. Mirrors the agent-frontend's
// tested parser (its lib/sse): split on blank lines, take `data:` lines, skip the
// `[DONE]` sentinel, JSON-parse each block into a §9 event, fall back to a delta
// for raw-text payloads, and hand back an incomplete trailing block as `tail` for
// the streaming reader to prepend to the next chunk. Tolerant by design — unknown
// event types and extra fields are ignored, never fatal (§9: a client must
// silently skip an unknown type rather than tear down the stream).
import type {AssistantStreamEvent, Citation} from "./types";

/** Current §9 schema version (S1 `0d36d43`). Defaulted when an event omits `v`. */
export const SSE_SCHEMA_V = 1;

// Raw §9 event off the wire (a superset of StreamChatEvent — we read the known
// fields and ignore the rest, so a newer backend shape never breaks parsing).
export interface RawSseEvent {
  type?: string;
  v?: number | string; // §9: string "1" on the wire; normalized to number on map
  buffered?: boolean;
  text?: string;
  delta?: string;
  content?: string;
  message?: string;
  tokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  citations?: unknown;
  sources?: unknown;
}

export interface ParsedSse {
  events: RawSseEvent[];
  /** Trailing partial block (no terminating blank line) to prepend next read. */
  tail: string;
}

/** Split an accumulated SSE buffer into complete events + a re-bufferable tail. */
export function parseSseChunk(chunk: string): ParsedSse {
  const events: RawSseEvent[] = [];
  const blocks = chunk.split(/\n\n/);

  for (const block of blocks) {
    const data = block
      .split(/\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();
    if (!data || data === "[DONE]") continue;
    try {
      events.push(JSON.parse(data) as RawSseEvent);
    } catch {
      // Non-JSON payload (some routes stream raw tokens) → treat as a delta.
      events.push({type: "delta", text: data});
    }
  }

  // The last block is only complete if the chunk ended on a blank-line boundary;
  // otherwise it's a partial event we hand back to be re-buffered.
  const tail = chunk.endsWith("\n\n") ? "" : (blocks.at(-1) ?? "");
  return {events, tail};
}

function extractCitations(raw: RawSseEvent): Citation[] | undefined {
  const list = Array.isArray(raw.citations)
    ? raw.citations
    : Array.isArray(raw.sources)
      ? raw.sources
      : null;
  if (!list?.length) return undefined;
  const mapped = list.reduce<Citation[]>((acc, item) => {
    if (!item || typeof item !== "object") return acc;
    const c = item as Record<string, unknown>;
    const title =
      typeof c.sectionTitle === "string"
        ? c.sectionTitle
        : typeof c.title === "string"
          ? c.title
          : undefined;
    acc.push({
      index: typeof c.index === "number" ? c.index : undefined,
      title,
      fileName: typeof c.fileName === "string" ? c.fileName : undefined,
      snippet: typeof c.snippet === "string" ? c.snippet : undefined,
      source:
        typeof c.retrievalSource === "string"
          ? c.retrievalSource
          : typeof c.source === "string"
            ? c.source
            : undefined,
    });
    return acc;
  }, []);
  return mapped.length ? mapped : undefined;
}

/**
 * Map a raw §9 event to the UI-facing AssistantStreamEvent. Returns null for
 * events the IM assistant doesn't act on (unknown types, empty deltas) — the
 * caller skips nulls, so an unrecognized type is silently tolerated.
 */
export function mapAssistantEvent(raw: RawSseEvent): AssistantStreamEvent | null {
  if (!raw || typeof raw !== "object") return null;
  // §9 sends `v` as a string ("1"); normalize to a number, default to the known
  // schema version when absent/garbage. (v is informational — the UI ignores it.)
  const v = Number(raw.v) || SSE_SCHEMA_V;
  switch (raw.type) {
    case "start":
      return {type: "start", v, buffered: raw.buffered === true};
    case "delta": {
      const text = raw.text ?? raw.delta ?? raw.content ?? "";
      if (!text) return null;
      return {type: "delta", v, text, buffered: raw.buffered === true};
    }
    case "usage": {
      const tokens =
        typeof raw.tokens === "number" ? raw.tokens : (raw.inputTokens ?? 0) + (raw.outputTokens ?? 0);
      return {type: "usage", v, tokens};
    }
    case "done":
      return {type: "done", v, citations: extractCitations(raw)};
    case "error":
      return {type: "error", v, message: raw.message || "灵犀出错了,请稍后再试"};
    default:
      return null; // unknown §9 type (forward-compat) → tolerate by ignoring
  }
}

/**
 * Pull the answer text out of a NON-SSE (buffered) response body — used when the
 * routed endpoint returns a JSON envelope `{code,data:{…}}` with the whole answer
 * instead of an event stream (§9 buffered routes / `/api/agent/chat`). Best-effort
 * across common field names; falls back to the raw body when it isn't JSON.
 */
export function extractBufferedAnswer(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const data =
      parsed && typeof parsed === "object" && "data" in parsed
        ? (parsed as {data?: unknown}).data
        : parsed;
    if (typeof data === "string") return data;
    if (data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      for (const key of ["answer", "content", "text", "reply", "message"]) {
        if (typeof d[key] === "string" && d[key]) return d[key] as string;
      }
    }
    return "";
  } catch {
    return trimmed; // not JSON — treat the raw body as the answer
  }
}

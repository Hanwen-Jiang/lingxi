import {useCallback, useEffect, useRef, useState} from "react";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";

import {api} from "./index";
import type {Message, Page} from "./types";

export function useConversations() {
  return useQuery({queryKey: ["conversations"], queryFn: () => api.listConversations()});
}

export function useMessages(sessionId?: string) {
  return useQuery({
    queryKey: ["messages", sessionId],
    queryFn: () => api.listMessages(sessionId as string),
    enabled: Boolean(sessionId),
  });
}

export function useFriends() {
  return useQuery({queryKey: ["friends"], queryFn: () => api.listFriends()});
}

export function useApplies() {
  return useQuery({queryKey: ["applies"], queryFn: () => api.listApplies()});
}

let assistantSeq = 0;

/**
 * Streaming send for the 灵犀 assistant (assistant-in-IM). Adds the user message
 * + a growing assistant message to the message cache, fed by streamAssistant's
 * SSE-shaped events. P2 swaps the mock stream for `/api/agent/chat` — the cache
 * mechanics here don't change.
 */
export function useAssistantStream(sessionId: string) {
  const qc = useQueryClient();
  const me = api.me();
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const botIdRef = useRef<string | null>(null);

  const patchBot = useCallback(
    (botId: string, fn: (m: Message) => Message) => {
      qc.setQueryData<Page<Message>>(["messages", sessionId], (old) =>
        old ? {...old, items: old.items.map((m) => (m.id === botId ? fn(m) : m))} : old,
      );
    },
    [qc, sessionId],
  );

  const send = useCallback(
    (content: string) => {
      const text = content.trim();
      if (!text || streaming) return;
      const userId = `tmp-${Date.now()}-${assistantSeq++}`;
      const botId = `as-${Date.now()}-${assistantSeq++}`;
      const at = Date.now();
      const userMsg: Message = {
        id: userId,
        clientTempId: userId,
        sessionId,
        senderId: me.id,
        kind: "text",
        content: text,
        createdAt: at,
        delivery: "sent",
      };
      const botMsg: Message = {
        id: botId,
        sessionId,
        senderId: "u-lingxi",
        kind: "text",
        content: "",
        createdAt: at + 1,
        delivery: "delivered",
        streaming: true,
      };
      qc.setQueryData<Page<Message>>(["messages", sessionId], (old) =>
        old ? {...old, items: [...old.items, userMsg, botMsg]} : {items: [userMsg, botMsg]},
      );
      botIdRef.current = botId;
      setStreaming(true);

      abortRef.current = api.streamAssistant(sessionId, text, (e) => {
        switch (e.type) {
          case "delta":
            patchBot(botId, (m) => ({...m, content: m.content + e.text}));
            break;
          case "done":
            patchBot(botId, (m) => ({...m, streaming: false}));
            setStreaming(false);
            abortRef.current = null;
            qc.invalidateQueries({queryKey: ["conversations"]});
            break;
          case "error":
            // Surface the agent's §9 error message (e.g. "AI 模型未配置…") when the
            // bubble is still empty; keep any partial text on a mid-stream error.
            patchBot(botId, (m) => ({
              ...m,
              streaming: false,
              content: m.content || e.message || "（出错了,稍后再试)",
            }));
            setStreaming(false);
            abortRef.current = null;
            break;
          case "start":
          case "usage":
            break;
        }
      });
    },
    [qc, me.id, sessionId, streaming, patchBot],
  );

  /** Abort an in-flight stream (e.g., user hit stop), keeping the partial text. */
  const stop = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    if (botIdRef.current) patchBot(botIdRef.current, (m) => ({...m, streaming: false}));
    setStreaming(false);
  }, [patchBot]);

  useEffect(() => () => abortRef.current?.(), []);

  return {send, stop, streaming};
}

/** Accept/reject a friend application; refreshes the apply box and friend list. */
export function useRespondApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({applyId, accept}: {applyId: string; accept: boolean}) =>
      api.respondApply(applyId, accept),
    onSuccess: () => {
      qc.invalidateQueries({queryKey: ["applies"]});
      qc.invalidateQueries({queryKey: ["friends"]});
    },
  });
}

let tempSeq = 0;
const newTempId = () => `tmp-${Date.now()}-${tempSeq++}`;

/**
 * Optimistic send (ADR 0002 §5/§6): render a `sending` bubble immediately with a
 * clientTempId, then reconcile to the server message on success (dedup by id) or
 * mark `failed` (retryable) on error. The real WS path will also dedup the echo
 * by messageId against this same cache.
 */
export function useSendMessage(sessionId: string) {
  const qc = useQueryClient();
  const me = api.me();
  const key = ["messages", sessionId] as const;

  return useMutation({
    mutationFn: (content: string) => api.sendMessage(sessionId, content),
    onMutate: async (content): Promise<{tempId: string}> => {
      await qc.cancelQueries({queryKey: key});
      const tempId = newTempId();
      const optimistic: Message = {
        id: tempId,
        clientTempId: tempId,
        sessionId,
        senderId: me.id,
        kind: "text",
        content,
        createdAt: Date.now(),
        delivery: "sending",
      };
      qc.setQueryData<Page<Message>>(key, (old) =>
        old ? {...old, items: [...old.items, optimistic]} : {items: [optimistic]},
      );
      return {tempId};
    },
    onSuccess: (res, _content, ctx) => {
      qc.setQueryData<Page<Message>>(key, (old) => {
        if (!old) return {items: [res.message]};
        const items = old.items.filter((m) => m.clientTempId !== ctx.tempId);
        if (!items.some((m) => m.id === res.message.id)) items.push(res.message);
        return {...old, items};
      });
      qc.invalidateQueries({queryKey: ["conversations"]});
    },
    onError: (_err, _content, ctx) => {
      qc.setQueryData<Page<Message>>(key, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((m) =>
                m.clientTempId === ctx?.tempId ? {...m, delivery: "failed" as const} : m,
              ),
            }
          : old,
      );
    },
  });
}

// Files awaiting (or recovering from a failed) image send, keyed by the bubble's
// clientTempId — lets a failed image bubble retry the full upload+send pipeline
// (the File can't live in the query cache).
const pendingImages = new Map<string, File>();

/**
 * Optimistic image send (M11). Renders the picked image immediately from a local
 * object URL, uploads it to object storage (presigned PUT), then sends a PICTURE
 * message and reconciles to the server message. The blob URL is revoked on
 * success; kept on failure so the failed bubble still previews for retry.
 */
export function useSendImage(sessionId: string) {
  const qc = useQueryClient();
  const me = api.me();
  const key = ["messages", sessionId] as const;

  const mutation = useMutation({
    mutationFn: async (input: {file: File}) => {
      const media = await api.uploadMedia(input.file);
      return api.sendImageMessage(sessionId, media.fileUrl, input.file.size);
    },
    onMutate: async ({file}): Promise<{tempId: string; previewUrl: string}> => {
      await qc.cancelQueries({queryKey: key});
      const tempId = newTempId();
      pendingImages.set(tempId, file);
      const previewUrl = URL.createObjectURL(file);
      const optimistic: Message = {
        id: tempId,
        clientTempId: tempId,
        sessionId,
        senderId: me.id,
        kind: "image",
        content: previewUrl,
        createdAt: Date.now(),
        delivery: "sending",
      };
      qc.setQueryData<Page<Message>>(key, (old) =>
        old ? {...old, items: [...old.items, optimistic]} : {items: [optimistic]},
      );
      return {tempId, previewUrl};
    },
    onSuccess: (res, _input, ctx) => {
      qc.setQueryData<Page<Message>>(key, (old) => {
        if (!old) return {items: [res.message]};
        const items = old.items.filter((m) => m.clientTempId !== ctx.tempId);
        if (!items.some((m) => m.id === res.message.id)) items.push(res.message);
        return {...old, items};
      });
      pendingImages.delete(ctx.tempId);
      URL.revokeObjectURL(ctx.previewUrl);
      qc.invalidateQueries({queryKey: ["conversations"]});
    },
    onError: (_err, _input, ctx) => {
      qc.setQueryData<Page<Message>>(key, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((m) =>
                m.clientTempId === ctx?.tempId ? {...m, delivery: "failed" as const} : m,
              ),
            }
          : old,
      );
    },
  });

  const send = useCallback((file: File) => mutation.mutate({file}), [mutation]);

  /** Retry a failed image bubble: drop the failed bubble and re-run the pipeline. */
  const retry = useCallback(
    (clientTempId: string) => {
      const file = pendingImages.get(clientTempId);
      if (!file) return;
      pendingImages.delete(clientTempId);
      qc.setQueryData<Page<Message>>(key, (old) =>
        old ? {...old, items: old.items.filter((m) => m.clientTempId !== clientTempId)} : old,
      );
      mutation.mutate({file});
    },
    [qc, key, mutation],
  );

  return {send, retry};
}

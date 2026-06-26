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

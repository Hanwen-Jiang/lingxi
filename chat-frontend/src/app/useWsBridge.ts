import {useEffect} from "react";

import {useQueryClient} from "@tanstack/react-query";

import {api} from "@/api";
import type {Message, Page} from "@/api/types";
import {WsClient} from "@/api/ws/WsClient";
import {useUiStore} from "@/store/ui";

const BACKEND_SESSION_ID = /^\d+$/;

/**
 * Drives the WsClient (ADR 0002) and bridges its push into the react-query cache
 * (WS is a cache side-effect layer, not a parallel store). The client owns
 * reconnect/backoff/heartbeat/ack/dedup; here we map normalized push events to
 * cache invalidations and backfill the gap on reconnect. In Mock mode the same
 * client runs against the simulated transport.
 */
export function useWsBridge() {
  const qc = useQueryClient();
  const setConnection = useUiStore((s) => s.setConnection);

  useEffect(() => {
    const client = new WsClient({
      transportFactory: () => api.openWs(),
      onState: setConnection,
      onPush: (e) => {
        switch (e.type) {
          case "message": {
            // Write the pushed message straight into the thread cache (dedup by
            // id) rather than a full refetch — the push carries the full payload
            // (incl. an image's url, which a history refetch would not), and it's
            // cheaper. The conversation list still refetches for preview/unread.
            const m = e.message;
            qc.setQueryData<Page<Message>>(["messages", m.sessionId], (old) => {
              if (!old) return undefined; // thread not loaded yet — list refetch covers it
              if (m.id && old.items.some((x) => x.id === m.id)) return old;
              return {...old, items: [...old.items, m]};
            });
            qc.invalidateQueries({queryKey: ["conversations"]});
            break;
          }
          case "new-session":
            qc.invalidateQueries({queryKey: ["conversations"]});
            break;
          case "friend-application":
            qc.invalidateQueries({queryKey: ["applies"]});
            break;
          case "presence":
            break;
        }
      },
      onReconnect: () => {
        // Backfill the window we may have missed while disconnected (ADR 0002 §3.3).
        // Only backend IM sessions have history to refetch. Client-only threads
        // such as `s-lingxi` are local streaming state; refetching them returns
        // an empty page and erases the in-flight assistant bubble during WS flaps.
        qc.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "messages" &&
            typeof query.queryKey[1] === "string" &&
            BACKEND_SESSION_ID.test(query.queryKey[1]),
        });
        qc.invalidateQueries({queryKey: ["conversations"]});
      },
    });

    client.start();
    return () => client.stop();
  }, [qc, setConnection]);
}

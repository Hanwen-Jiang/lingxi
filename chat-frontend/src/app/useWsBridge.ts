import {useEffect} from "react";

import {useQueryClient} from "@tanstack/react-query";

import {api} from "@/api";
import {WsClient} from "@/api/ws/WsClient";
import {useUiStore} from "@/store/ui";

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
          case "message":
            qc.invalidateQueries({queryKey: ["messages", e.message.sessionId]});
            qc.invalidateQueries({queryKey: ["conversations"]});
            break;
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
        qc.invalidateQueries({queryKey: ["messages"]});
        qc.invalidateQueries({queryKey: ["conversations"]});
      },
    });

    client.start();
    return () => client.stop();
  }, [qc, setConnection]);
}

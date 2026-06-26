import {useEffect} from "react";

import {useQueryClient} from "@tanstack/react-query";

import {api} from "@/api";
import {useUiStore} from "@/store/ui";

/**
 * Bridges WS push into the react-query cache (ADR 0002: WS is a cache side-effect
 * layer, not a parallel store). In Mock mode this drives the assistant reply and
 * the connecting→online transition. The real client adds reconnect/backoff/
 * heartbeat/ack on top of this same dispatch.
 */
export function useWsBridge() {
  const qc = useQueryClient();
  const setConnection = useUiStore((s) => s.setConnection);

  useEffect(() => {
    setConnection("connecting");
    const t = setTimeout(() => setConnection("online"), 450);

    const off = api.connectWs((e) => {
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
    });

    return () => {
      clearTimeout(t);
      off();
    };
  }, [qc, setConnection]);
}

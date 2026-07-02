// React hook for subscribing to Data API SSE events.
// Reconnects automatically with exponential backoff (max 30 s).
import { useEffect, useRef } from "react";

const SSE_BASE        = import.meta.env?.VITE_DATA_API_URL ?? "http://localhost:4000";
const SSE_KEY         = import.meta.env?.VITE_DATA_API_KEY  ?? "";
const INITIAL_BACKOFF = 1_000;
const MAX_BACKOFF     = 30_000;

export function useSSE(gameId, onEvent) {
  // Keep the callback stable without forcing a reconnect on every render.
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!gameId) return;

    let es;
    let backoff = INITIAL_BACKOFF;
    let stopped = false;

    function connect() {
      const url = `${SSE_BASE}/api/v1/sse?gameId=${gameId}&key=${encodeURIComponent(SSE_KEY)}`;
      es = new EventSource(url);

      es.onopen = () => { backoff = INITIAL_BACKOFF; };

      es.onmessage = (e) => {
        try { onEventRef.current(JSON.parse(e.data)); } catch {}
      };

      es.onerror = () => {
        es.close();
        if (!stopped) {
          setTimeout(connect, backoff);
          backoff = Math.min(backoff * 2, MAX_BACKOFF);
        }
      };
    }

    connect();
    return () => {
      stopped = true;
      es?.close();
    };
  }, [gameId]);
}

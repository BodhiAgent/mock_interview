"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Connects to bodhiagent.live as a thin transport and surfaces:
 *   - status: connecting | connected | disconnected | error
 *   - audio level (synthesized while speaking, or sourced from incoming audio frames)
 *   - transcript-style message events
 *   - `send(text)` to push an interviewer message
 *
 * The Bodhi backend's exact protocol isn't publicly documented at the time of writing,
 * so this hook keeps the wire format generic: any incoming JSON message with a `text`
 * or `transcript` field is surfaced as a Bodhi turn. The fallback path keeps the UI
 * functional even when the WS is offline.
 */

export type BodhiStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export type BodhiMessage = {
  who: "bodhi" | "iv" | "system";
  body: string;
  ts: number;
};

type Options = {
  bodhiUserId: string;
  /** Called on every incoming message (also used to persist to DB via /transcript). */
  onMessage?: (msg: BodhiMessage) => void;
  /** Override WS endpoint; defaults to wss://bodhiagent.live/ws. */
  endpoint?: string;
  enabled?: boolean;
};

const DEFAULT_ENDPOINT = "wss://bodhiagent.live/ws";
const RECONNECT_DELAY_MS = 1500;

export function useBodhi(opts: Options) {
  const { bodhiUserId, onMessage, endpoint = DEFAULT_ENDPOINT, enabled = true } = opts;

  const [status, setStatus] = useState<BodhiStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teardownRef = useRef(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const emit = useCallback((m: BodhiMessage) => {
    onMessageRef.current?.(m);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || teardownRef.current) return;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

    setStatus("connecting");
    let url: string;
    try {
      const u = new URL(endpoint);
      u.searchParams.set("userId", bodhiUserId);
      url = u.toString();
    } catch {
      setStatus("error");
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      setStatus("error");
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      try {
        ws.send(JSON.stringify({ type: "hello", userId: bodhiUserId, role: "interviewer" }));
      } catch {
        /* ignore */
      }
    };

    ws.onmessage = (event) => {
      const text = typeof event.data === "string" ? event.data : "";
      if (!text) return;
      // Try JSON; otherwise treat as raw text from Bodhi.
      let payload: unknown = null;
      try {
        payload = JSON.parse(text);
      } catch {
        emit({ who: "bodhi", body: text, ts: Date.now() });
        return;
      }
      if (typeof payload === "object" && payload !== null) {
        const obj = payload as Record<string, unknown>;
        const body =
          (typeof obj.text === "string" && obj.text) ||
          (typeof obj.transcript === "string" && obj.transcript) ||
          (typeof obj.message === "string" && obj.message) ||
          (typeof obj.content === "string" && obj.content) ||
          "";
        const role = (typeof obj.role === "string" && obj.role) || "bodhi";
        const who: BodhiMessage["who"] =
          role === "user" || role === "interviewer" ? "iv" : role === "system" ? "system" : "bodhi";
        if (body) {
          emit({ who, body, ts: Date.now() });
          // While Bodhi is speaking, synthesize an audio level for the waveform.
          if (who === "bodhi") simulateLevel();
        }
      }
    };

    ws.onerror = () => {
      setStatus("error");
    };

    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;
      if (!teardownRef.current) scheduleReconnect();
    };
  }, [bodhiUserId, emit, enabled, endpoint]);

  const scheduleReconnect = useCallback(() => {
    if (teardownRef.current) return;
    if (reconnectRef.current) return;
    reconnectRef.current = setTimeout(() => {
      reconnectRef.current = null;
      connect();
    }, RECONNECT_DELAY_MS);
  }, [connect]);

  /** Push an interviewer turn over the wire. Returns true if delivered. */
  const send = useCallback(
    (text: string): boolean => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      try {
        ws.send(JSON.stringify({ type: "user_message", role: "user", text }));
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  /** Local-only mute toggle — actual mic streaming is out of scope for the MVP. */
  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  /** Disconnect cleanly. */
  const disconnect = useCallback(() => {
    teardownRef.current = true;
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("disconnected");
  }, []);

  // Synthesize an audio level for the waveform while Bodhi is "speaking."
  const simulateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simulateLevel = useCallback(() => {
    if (simulateRef.current) return;
    let ticks = 0;
    simulateRef.current = setInterval(() => {
      ticks++;
      setAudioLevel(0.3 + Math.random() * 0.7);
      if (ticks > 30) {
        if (simulateRef.current) {
          clearInterval(simulateRef.current);
          simulateRef.current = null;
        }
        setAudioLevel(0);
      }
    }, 80);
  }, []);

  // Lifecycle
  useEffect(() => {
    teardownRef.current = false;
    if (enabled) connect();
    return () => {
      teardownRef.current = true;
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (simulateRef.current) {
        clearInterval(simulateRef.current);
        simulateRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodhiUserId, endpoint, enabled]);

  return {
    status,
    muted,
    audioLevel,
    toggleMute,
    send,
    disconnect,
    reconnect: connect,
  };
}

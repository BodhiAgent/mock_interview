"use client";

import { useEffect, useRef, useState } from "react";
import type { BodhiStatus } from "@/lib/useBodhi";

export type TranscriptItem = {
  id: string | number;
  who: "bodhi" | "iv" | "system";
  body: string;
  ts: number;
};

type Props = {
  status: BodhiStatus;
  muted: boolean;
  audioLevel: number;
  transcript: TranscriptItem[];
  inputDisabled: boolean;
  onSend: (text: string) => void;
  onMute: () => void;
  onEnd: () => void;
  startedAt: number;
};

export function BodhiPanel({
  status,
  muted,
  audioLevel,
  transcript,
  inputDisabled,
  onSend,
  onMute,
  onEnd,
  startedAt,
}: Props) {
  const [draft, setDraft] = useState("");
  const txRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    txRef.current?.scrollTo({ top: txRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  const dotClass =
    status === "connected" ? "" : status === "connecting" ? "connecting" : "off";
  const statusLabel: { verb: string; obj: string } =
    status === "connected"
      ? { verb: muted ? "Listening" : "Listening", obj: muted ? "you are muted" : "for your question" }
      : status === "connecting"
        ? { verb: "Connecting", obj: "to Bodhi…" }
        : status === "error"
          ? { verb: "Error", obj: "tap Reconnect" }
          : { verb: "Offline", obj: "voice unavailable" };

  return (
    <aside className="bodhi">
      <header className="bodhi-head">
        <div className="ttl">
          <span className={`live-dot ${dotClass}`} />
          Bodhi · Voice Agent
        </div>
        <div className="meta-r">{status === "connected" ? "wss · live" : "wss · idle"}</div>
      </header>

      <section className="agent">
        <div className={`avatar-wrap ${status === "connected" ? "" : "idle"}`}>
          <span className="ring" />
          <div className="avatar">
            <img src="/bodhi-avatar.png" alt="Bodhi" />
          </div>
        </div>
        <div className="agent-name">Bodhi</div>
        <div className="agent-role">Senior IC · Interviewee</div>

        <div className="status">
          <span className="pulse" />
          <span><b>{statusLabel.verb}</b></span>
          <span className="obj">{statusLabel.obj}</span>
        </div>

        <Wave level={audioLevel} />
      </section>

      <div className="transcript" ref={txRef}>
        {transcript.length === 0 && (
          <div className="msg system">
            <div className="who">Session</div>
            <div className="body">Type a question below or wait for Bodhi to speak.</div>
          </div>
        )}
        {transcript.map((m) => (
          <div className={`msg ${m.who}`} key={m.id}>
            <div className="who">
              {m.who === "bodhi" ? "Bodhi" : m.who === "iv" ? "Interviewer" : "System"}
              <span>·</span>
              <span className="ts">{relTime(startedAt, m.ts)}</span>
            </div>
            <div className="body" dangerouslySetInnerHTML={{ __html: renderBody(m.body) }} />
          </div>
        ))}
      </div>

      <div className="iv-input">
        <input
          type="text"
          placeholder={inputDisabled ? "Voice unavailable…" : "Ask Bodhi a question…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={inputDisabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onSend(draft.trim());
              setDraft("");
            }
          }}
        />
        <button
          type="button"
          disabled={inputDisabled || !draft.trim()}
          onClick={() => {
            if (draft.trim()) {
              onSend(draft.trim());
              setDraft("");
            }
          }}
        >
          Send
        </button>
      </div>

      <footer className="controls">
        <button className={`ctlbtn ${muted ? "muted" : ""}`} type="button" onClick={onMute}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <rect x={9} y={3} width={6} height={12} rx={3} />
            <path d="M5 11a7 7 0 0014 0M12 19v3" />
          </svg>
          {muted ? "Muted" : "Mute"}
        </button>
        <button className="ctlbtn" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <rect x={3} y={5} width={18} height={14} rx={2} />
            <path d="M8 11h2M14 11h2M8 15h3M13 15h3" />
          </svg>
          CC
        </button>
        <button className="ctlbtn" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <circle cx={12} cy={12} r={2.5} />
            <path d="M19.4 12a7.4 7.4 0 00-.1-1.2l2-1.5-2-3.4-2.4.9a7 7 0 00-2-1.2L14 3h-4l-.5 2.6a7 7 0 00-2 1.2l-2.4-.9-2 3.4 2 1.5" />
          </svg>
          Audio
        </button>
        <button className="ctlbtn end" type="button" onClick={onEnd}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M2 16c4-5 16-5 20 0l-2 2-3-1-1-3a14 14 0 00-8 0l-1 3-3 1z" />
          </svg>
          End
        </button>
      </footer>
    </aside>
  );
}

function Wave({ level }: { level: number }) {
  // Pre-compute heights on the client only to avoid SSR hydration mismatches.
  const [heights, setHeights] = useState<number[]>(() => new Array(32).fill(4));
  useEffect(() => {
    setHeights(Array.from({ length: 32 }, () => 3 + Math.random() * 5));
  }, []);
  return (
    <div className="wave" aria-hidden="true">
      {heights.map((h, i) => (
        <i
          key={i}
          style={{
            animationDelay: `${(i * 0.04).toFixed(2)}s`,
            height: `${h.toFixed(0)}px`,
            opacity: level > 0 ? 0.85 : 0.4,
            animationPlayState: level > 0 ? "running" : "paused",
          }}
        />
      ))}
    </div>
  );
}

function relTime(start: number, ts: number): string {
  const sec = Math.max(0, Math.floor((ts - start) / 1000));
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

function renderBody(s: string): string {
  return escape(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;",
  );
}

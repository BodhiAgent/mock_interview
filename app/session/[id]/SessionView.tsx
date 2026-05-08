"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { Rail } from "@/components/Rail";
import { ProblemPane } from "@/components/session/ProblemPane";
import { CodeLab, type RunEvent } from "@/components/session/CodeLab";
import { BodhiPanel, type TranscriptItem } from "@/components/session/BodhiPanel";
import { useBodhi, type BodhiMessage } from "@/lib/useBodhi";
import type { Problem } from "@/lib/problems";
import type { SessionRow, TranscriptRow } from "@/lib/db";

type Props = {
  session: SessionRow;
  problem: Problem;
  initialTranscript: TranscriptRow[];
};

export function SessionView({ session, problem, initialTranscript }: Props) {
  const router = useRouter();

  const [code, setCode] = useState(session.code || problem.stub);
  const codeRef = useRef(code);
  codeRef.current = code;

  const [events, setEvents] = useState<RunEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const [transcript, setTranscript] = useState<TranscriptItem[]>(
    initialTranscript.map((t) => ({ id: t.id, who: t.who, body: t.body, ts: t.ts })),
  );

  // Persist a finalized turn to the DB. We only call this once per turn, after
  // streaming settles, to avoid one row per token.
  const persistTranscript = useCallback(
    async (msg: { who: BodhiMessage["who"]; body: string }) => {
      try {
        await fetch(`/api/sessions/${session.id}/transcript`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ who: msg.who, body: msg.body }),
        });
      } catch {
        /* swallow — local optimistic state already shown */
      }
    },
    [session.id],
  );

  /**
   * bodhiagent.live streams cumulative text — every WS frame contains the full
   * turn so far ("Hello", "Hello.", "Hello. I", …). We coalesce successive
   * frames from the same speaker into a single transcript row and debounce a
   * final DB write so the transcript table has one row per turn, not one per
   * token. A new speaker (or a new opening that doesn't extend the last text)
   * starts a fresh row.
   */
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFinal = useRef<{ who: BodhiMessage["who"]; body: string } | null>(null);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      const m = pendingFinal.current;
      pendingFinal.current = null;
      flushTimer.current = null;
      if (m) void persistTranscript(m);
    }, 1200);
  }, [persistTranscript]);

  const onBodhiMessage = useCallback(
    (msg: BodhiMessage) => {
      setTranscript((prev) => {
        // Look back at recent messages from the same speaker (within 30s) and
        // either replace one we're extending, drop an exact duplicate, or
        // collapse one that was a strict prefix of this one.
        const RECENT_MS = 30_000;
        const RECENT_LOOKBACK = 6;
        const start = Math.max(0, prev.length - RECENT_LOOKBACK);
        for (let i = prev.length - 1; i >= start; i--) {
          const c = prev[i];
          if (c.who !== msg.who) break;
          if (msg.ts - c.ts > RECENT_MS) break;
          if (c.body === msg.body) {
            // Exact duplicate — drop.
            return prev;
          }
          if (msg.who !== "iv" && msg.body.startsWith(c.body)) {
            // New extends candidate's body — replace candidate.
            const updated = [...prev];
            updated[i] = { ...c, body: msg.body, ts: msg.ts };
            return updated;
          }
          if (msg.who !== "iv" && c.body.startsWith(msg.body)) {
            // Candidate is already a superset — drop new.
            return prev;
          }
        }
        return [
          ...prev,
          { id: `${msg.who}-${msg.ts}-${Math.random()}`, who: msg.who, body: msg.body, ts: msg.ts },
        ];
      });

      pendingFinal.current = { who: msg.who, body: msg.body };
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const bodhi = useBodhi({
    bodhiUserId: session.bodhi_user_id,
    onMessage: onBodhiMessage,
  });

  // Persist code edits (debounced).
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCodeChange = useCallback(
    (v: string) => {
      setCode(v);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        fetch(`/api/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: v }),
        }).catch(() => {});
      }, 500);
    },
    [session.id],
  );

  const handleRun = useCallback(
    async (kind: "run" | "submit") => {
      if (isRunning) return;
      setIsRunning(true);
      setEvents([]);
      try {
        const res = await fetch(`/api/sessions/${session.id}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: codeRef.current, kind }),
        });
        if (!res.body) {
          setEvents((e) => [...e, { type: "stderr", chunk: "no response body" }, { type: "done", exitCode: -1, durationMs: 0 }]);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const frame = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 2);
            if (!frame.startsWith("data:")) continue;
            const json = frame.slice(5).trim();
            try {
              const ev = JSON.parse(json) as RunEvent;
              setEvents((prev) => [...prev, ev]);
            } catch {
              /* ignore */
            }
          }
        }
      } catch (e) {
        setEvents((prev) => [
          ...prev,
          { type: "stderr", chunk: `[client] ${(e as Error).message}` },
          { type: "done", exitCode: -1, durationMs: 0 },
        ]);
      } finally {
        setIsRunning(false);
      }
    },
    [isRunning, session.id],
  );

  // ⌘↵ runs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void handleRun(e.shiftKey ? "submit" : "run");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleRun]);

  const handleSendToBodhi = useCallback(
    (text: string) => {
      const ts = Date.now();
      setTranscript((prev) => [...prev, { id: `iv-${ts}`, who: "iv", body: text, ts }]);
      void persistTranscript({ who: "iv", body: text });
      const delivered = bodhi.send(text);
      if (!delivered) {
        // Echo a system note.
        setTranscript((prev) => [
          ...prev,
          {
            id: `sys-${ts}`,
            who: "system",
            body: "Voice channel offline — message saved to transcript only.",
            ts: Date.now(),
          },
        ]);
      }
    },
    [bodhi, persistTranscript],
  );

  const handleEnd = useCallback(async () => {
    bodhi.disconnect();
    try {
      await fetch(`/api/sessions/${session.id}/end`, { method: "POST" });
    } catch {
      /* ignore */
    }
    router.push(`/session/${session.id}/replay`);
  }, [bodhi, router, session.id]);

  return (
    <div className="app">
      <Topbar problemTitle={problem.title} startedAt={session.started_at} onExit={handleEnd} />
      <main className="main">
        <Rail />
        <ProblemPane problem={problem} />
        <CodeLab
          initialCode={session.code || problem.stub}
          onCodeChange={onCodeChange}
          onRun={handleRun}
          isRunning={isRunning}
          events={events}
          bodhiConnected={bodhi.status === "connected"}
        />
        <BodhiPanel
          status={bodhi.status}
          muted={bodhi.muted}
          audioLevel={bodhi.audioLevel}
          transcript={transcript}
          inputDisabled={bodhi.status !== "connected"}
          onSend={handleSendToBodhi}
          onMute={bodhi.toggleMute}
          onEnd={handleEnd}
          startedAt={session.started_at}
        />
      </main>
    </div>
  );
}

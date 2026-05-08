import Link from "next/link";
import { notFound } from "next/navigation";
import * as DB from "@/lib/db";
import { getProblem } from "@/lib/problems";

export const dynamic = "force-dynamic";

export default async function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = DB.getSession(id);
  if (!session) notFound();
  const problem = getProblem(session.problem_id);
  if (!problem) notFound();

  const transcript = DB.listTranscript(id);
  const runs = DB.listRuns(id);
  const totalSec = session.ended_at
    ? Math.max(0, Math.floor((session.ended_at - session.started_at) / 1000))
    : Math.max(0, Math.floor((Date.now() - session.started_at) / 1000));

  return (
    <main className="catalog">
      <div className="hero">
        <div className="eyebrow">
          <span className="d" style={{ background: "var(--fg-3)", boxShadow: "none" }} />
          Replay · {session.status}
        </div>
        <h1>{problem.title}</h1>
        <p className="lead">
          Session <code style={{ fontFamily: "var(--mono)" }}>{session.id}</code> · ran for{" "}
          {Math.floor(totalSec / 60)}m {totalSec % 60}s · {transcript.length} transcript events ·{" "}
          {runs.length} runs.
        </p>
        <div style={{ marginTop: 16 }}>
          <Link href="/" className="ghostbtn" style={{ textDecoration: "none" }}>
            ← Back to catalog
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <section>
          <div className="h2" style={{ margin: "8px 0 12px" }}>
            Transcript
          </div>
          <div
            className="transcript"
            style={{
              border: "1px solid var(--line)",
              borderRadius: "var(--r-l)",
              background: "var(--bg-1)",
              padding: 16,
              maxHeight: 600,
            }}
          >
            {transcript.length === 0 && (
              <div className="msg system">
                <div className="who">System</div>
                <div className="body">No messages.</div>
              </div>
            )}
            {transcript.map((m) => (
              <div key={m.id} className={`msg ${m.who}`}>
                <div className="who">
                  {m.who === "bodhi" ? "Bodhi" : m.who === "iv" ? "Interviewer" : "System"} ·{" "}
                  <span className="ts">{relTime(session.started_at, m.ts)}</span>
                </div>
                <div className="body">{m.body}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="h2" style={{ margin: "8px 0 12px" }}>
            Final code
          </div>
          <pre
            style={{
              fontFamily: "var(--mono)",
              fontSize: 12.5,
              border: "1px solid var(--line)",
              borderRadius: "var(--r-l)",
              background: "var(--bg-1)",
              padding: 16,
              maxHeight: 320,
              overflow: "auto",
              color: "var(--fg)",
            }}
          >
            {session.code || problem.stub}
          </pre>

          <div className="h2" style={{ margin: "24px 0 12px" }}>
            Runs
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {runs.length === 0 && (
              <div style={{ color: "var(--fg-3)", fontSize: 12.5 }}>No runs.</div>
            )}
            {runs.map((r) => {
              const ok = r.exit_code === 0;
              const passLabel =
                typeof r.passed === "number" && typeof r.total === "number"
                  ? ` · ${r.passed}/${r.total}`
                  : "";
              return (
                <div
                  key={r.id}
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: "var(--r-m)",
                    background: "var(--bg-1)",
                    padding: 10,
                    fontFamily: "var(--mono)",
                    fontSize: 11.5,
                  }}
                >
                  <div style={{ color: ok ? "var(--green)" : "var(--red)" }}>
                    {ok ? "✓" : "✗"} {r.kind} · exit {r.exit_code} · {r.duration_ms}ms{passLabel}
                  </div>
                  {r.stderr && (
                    <pre style={{ color: "var(--red)", margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{r.stderr}</pre>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function relTime(start: number, ts: number): string {
  const sec = Math.max(0, Math.floor((ts - start) / 1000));
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

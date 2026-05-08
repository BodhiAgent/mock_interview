"use client";

import type { Problem } from "@/lib/problems";

export function ProblemPane({ problem }: { problem: Problem }) {
  const diffClass = problem.difficulty === "easy" ? "easy" : problem.difficulty === "medium" ? "med" : "hard";
  const diffLabel = problem.difficulty[0].toUpperCase() + problem.difficulty.slice(1);

  return (
    <section className="problem">
      <nav className="problem-tabs">
        <button className="ptab active" type="button">Description</button>
        <button className="ptab" type="button">Examples</button>
        <button className="ptab" type="button">
          Solution <span className="badge">locked</span>
        </button>
      </nav>

      <header className="problem-head">
        <div className="row">
          <span className="num">{problem.num}</span>
          <span>·</span>
          <span>Live Coding</span>
        </div>
        <h1>{problem.title}</h1>
        <div className="meta">
          <span className={`pill ${diffClass}`}>{diffLabel}</span>
          {problem.tags.map((t) => (
            <span key={t} className="pill tag">
              {t}
            </span>
          ))}
          <span className="stat">
            acc <b>{problem.accRate.toFixed(1)}%</b>
          </span>
          <span className="stat">
            avg <b>{problem.avgMinutes}m</b>
          </span>
          <span className="stat">
            solved <b>{problem.solved}</b>
          </span>
        </div>
      </header>

      <div className="problem-body">
        <p dangerouslySetInnerHTML={{ __html: renderInline(problem.body) }} />

        <div className="h2">Examples</div>
        {problem.examples.map((ex, i) => (
          <div className="ex" key={i}>
            <div className="erow">
              <span className="k">Input</span>
              <span className="v">{ex.input}</span>
            </div>
            <div className="erow">
              <span className="k">Output</span>
              <span className="v">{ex.output}</span>
            </div>
            {ex.note && (
              <div className="erow">
                <span className="k">Note</span>
                <span className="v note">{ex.note}</span>
              </div>
            )}
          </div>
        ))}

        <div className="h2">Constraints</div>
        <ul className="constraints">
          {problem.constraints.map((c, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(c) }} />
          ))}
        </ul>

        {problem.followUp && (
          <>
            <div className="h2">Follow-up</div>
            <p dangerouslySetInnerHTML={{ __html: renderInline(problem.followUp) }} />
          </>
        )}

        <div className="hint">
          <div className="h">
            <span className="d" />
            Hint from Bodhi
          </div>
          <div className="b" dangerouslySetInnerHTML={{ __html: renderInline(problem.hint) }} />
        </div>
      </div>
    </section>
  );
}

/** Tiny markdown-ish: backticks → <code>, **bold** → <strong>, *em* → <em>. */
function renderInline(s: string): string {
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

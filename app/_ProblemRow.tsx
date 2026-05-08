"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Problem = {
  id: string;
  num: string;
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  accRate: number;
};

export function ProblemRow({ problem }: { problem: Problem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemSlug: problem.slug }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { sessionId: string };
      router.push(`/session/${data.sessionId}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="problem-row"
      onClick={start}
      disabled={busy}
      style={{
        background: "transparent",
        border: 0,
        textAlign: "left",
        font: "inherit",
        color: "inherit",
        width: "100%",
      }}
    >
      <span className="num">{problem.num}</span>
      <span className="title">
        {problem.title}
        {err && <span style={{ color: "var(--red)", marginLeft: 8, fontSize: 12 }}>· {err}</span>}
      </span>
      <span className="tags">
        {problem.tags.slice(0, 2).map((t) => (
          <span key={t} className="pill tag">
            {t}
          </span>
        ))}
        <span
          className={`pill ${
            problem.difficulty === "easy" ? "easy" : problem.difficulty === "medium" ? "med" : "hard"
          }`}
        >
          {problem.difficulty[0].toUpperCase() + problem.difficulty.slice(1)}
        </span>
      </span>
      <span className="acc">{problem.accRate.toFixed(1)}%</span>
      <span className="arrow">{busy ? "…" : "→"}</span>
    </button>
  );
}

import Link from "next/link";
import { listProblems } from "@/lib/problems";
import { isUsingDaytona } from "@/lib/daytona";
import { StartButton } from "./_StartButton";

export const dynamic = "force-dynamic";

export default function CatalogPage() {
  const problems = listProblems();
  return (
    <main className="catalog">
      <div className="hero">
        <div className="eyebrow">
          <span className="d" />
          Mock Interview · Studio
        </div>
        <h1>
          Run a coding interview <em>against the candidate</em>.
        </h1>
        <p className="lead">
          Pick a problem. Bodhi joins as the interviewee — narrating the approach over voice
          while you watch the code take shape. Real Python execution in a Daytona sandbox,
          full transcript saved for replay.
        </p>
      </div>

      <div className="problem-list">
        {problems.map((p, i) => (
          <Link key={p.id} href={`/session/start?slug=${p.slug}`} className="problem-row" style={{ textDecoration: "none" }}>
            <span className="num">{p.num}</span>
            <span className="title">{p.title}</span>
            <span className="tags">
              {p.tags.slice(0, 2).map((t) => (
                <span key={t} className="pill tag">
                  {t}
                </span>
              ))}
              <span className={`pill ${p.difficulty === "easy" ? "easy" : p.difficulty === "medium" ? "med" : "hard"}`}>
                {p.difficulty[0].toUpperCase() + p.difficulty.slice(1)}
              </span>
            </span>
            <span className="acc">{p.accRate.toFixed(1)}%</span>
            <span className="arrow">→</span>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <StartButton problems={problems.map((p) => ({ slug: p.slug, title: p.title }))} />
      </div>

      <div className="catalog-foot">
        <span>{isUsingDaytona() ? "Daytona sandbox" : "Local sandbox (set DAYTONA_API_KEY)"}</span>
        <span className="dot" />
        <span>Voice via wss://bodhiagent.live</span>
        <span className="dot" />
        <span>{problems.length} problems</span>
      </div>
    </main>
  );
}

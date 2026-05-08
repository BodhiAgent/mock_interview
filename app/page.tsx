import { listProblems } from "@/lib/problems";
import { isUsingDaytona } from "@/lib/daytona";
import { ProblemRow } from "./_ProblemRow";

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
        {problems.map((p) => (
          <ProblemRow
            key={p.id}
            problem={{
              id: p.id,
              num: p.num,
              slug: p.slug,
              title: p.title,
              difficulty: p.difficulty,
              tags: p.tags,
              accRate: p.accRate,
            }}
          />
        ))}
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

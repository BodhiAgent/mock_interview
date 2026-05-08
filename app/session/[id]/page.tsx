import { notFound } from "next/navigation";
import * as DB from "@/lib/db";
import { getProblem } from "@/lib/problems";
import { SessionView } from "./SessionView";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = DB.getSession(id);
  if (!session) notFound();

  const problem = getProblem(session.problem_id);
  if (!problem) notFound();

  if (session.status === "ended") {
    // Redirect rendered ended sessions to the replay view.
    const transcript = DB.listTranscript(id);
    return (
      <div className="catalog">
        <div className="hero">
          <div className="eyebrow">
            <span className="d" />
            Session ended
          </div>
          <h1>{problem.title}</h1>
          <p className="lead">
            This session is over. <a href={`/session/${id}/replay`} style={{ textDecoration: "underline" }}>View replay</a> · {transcript.length} transcript events recorded.
          </p>
        </div>
      </div>
    );
  }

  const transcript = DB.listTranscript(id);
  return <SessionView session={session} problem={problem} initialTranscript={transcript} />;
}

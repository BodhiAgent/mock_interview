import { NextRequest, NextResponse } from "next/server";
import * as DB from "@/lib/db";
import { getProblem } from "@/lib/problems";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = DB.getSession(id);
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const problem = getProblem(session.problem_id);
  return NextResponse.json({
    session,
    problem,
    transcript: DB.listTranscript(id),
    runs: DB.listRuns(id),
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  if (typeof body.code === "string") {
    DB.updateSessionCode(id, body.code);
  }
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { problemSlug?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }
  if (!body.problemSlug) {
    return NextResponse.json({ error: "problemSlug required" }, { status: 400 });
  }
  try {
    const result = await createSession(body.problemSlug);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? "session creation failed" },
      { status: 500 },
    );
  }
}

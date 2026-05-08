import { NextRequest, NextResponse } from "next/server";
import * as DB from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    who?: "bodhi" | "iv" | "system";
    kind?: "speech" | "tool" | "system";
    body?: string;
  };
  if (!body.who || !body.body) {
    return NextResponse.json({ error: "who and body required" }, { status: 400 });
  }
  DB.appendTranscript({ sessionId: id, who: body.who, kind: body.kind, body: body.body });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { endSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await endSession(id);
  return NextResponse.json({ ok: true });
}

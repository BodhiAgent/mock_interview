import { NextResponse } from "next/server";
import { listProblems } from "@/lib/problems";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ problems: listProblems() });
}

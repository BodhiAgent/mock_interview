import { NextRequest } from "next/server";
import { getSandbox } from "@/lib/session";
import * as DB from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  code: string;
  kind?: "run" | "submit";
  stdin?: string;
};

/**
 * Streams run output back to the client as Server-Sent Events.
 * Events: { type: 'stdout' | 'stderr' | 'done', chunk?, exitCode?, durationMs?, runId?, passed?, total? }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await ctx.params;
  const session = DB.getSession(sessionId);
  if (!session) return new Response("not_found", { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const code = body.code ?? "";
  const kind: "run" | "submit" = body.kind === "submit" ? "submit" : "run";

  DB.updateSessionCode(sessionId, code);

  const sandbox = getSandbox(sessionId);
  if (!sandbox) {
    return new Response("sandbox_unavailable", { status: 410 });
  }

  await sandbox.writeFile("solution.py", code);

  const cmd = kind === "submit" ? "python tests.py" : "python solution.py";

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        send({ type: "start", kind });
        const result = await sandbox.exec(cmd, { timeoutMs: 10_000 });

        if (result.stdout) send({ type: "stdout", chunk: result.stdout });
        if (result.stderr) send({ type: "stderr", chunk: result.stderr });

        // If submit, parse the json summary from stdout to surface pass/fail counts.
        let passed: number | null = null;
        let total: number | null = null;
        if (kind === "submit" && result.stdout) {
          try {
            const parsed = JSON.parse(result.stdout) as { passed?: number; total?: number };
            if (typeof parsed.passed === "number") passed = parsed.passed;
            if (typeof parsed.total === "number") total = parsed.total;
          } catch {
            /* not json — leave null */
          }
        }

        const runId = DB.recordRun({
          sessionId,
          kind,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          durationMs: result.durationMs,
          passed,
          total,
        });

        send({
          type: "done",
          exitCode: result.exitCode,
          durationMs: result.durationMs,
          runId,
          passed,
          total,
        });
      } catch (e) {
        send({ type: "stderr", chunk: `[server] ${(e as Error).message}` });
        send({ type: "done", exitCode: -1, durationMs: 0 });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

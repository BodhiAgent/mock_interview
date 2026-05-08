import crypto from "node:crypto";
import * as DB from "./db";
import { createSandbox, type Sandbox } from "./daytona";
import { getProblem, type Problem } from "./problems";

/**
 * In-memory map of live sandboxes keyed by sessionId.
 * The sandbox handle isn't serializable, so we keep it in process memory and
 * tear it down when the session ends. SQLite remains the source of truth for
 * the durable bits (code, transcript, runs).
 */
const sandboxes = new Map<string, Sandbox>();

export type CreateSessionResult = {
  sessionId: string;
  bodhiUserId: string;
  problem: Problem;
};

export async function createSession(problemSlug: string): Promise<CreateSessionResult> {
  const problem = getProblem(problemSlug);
  if (!problem) throw new Error(`Unknown problem: ${problemSlug}`);

  const sessionId = `s_${crypto.randomBytes(8).toString("hex")}`;
  const bodhiUserId = `client_${crypto.randomBytes(12).toString("hex")}`;

  const sandbox = await createSandbox();
  sandboxes.set(sessionId, sandbox);

  // Seed the sandbox with the problem stub and hidden test runner.
  await sandbox.writeFile("solution.py", problem.stub);
  await sandbox.writeFile("tests.py", problem.testRunner);

  DB.createSession({
    id: sessionId,
    problemId: problem.id,
    bodhiUserId,
    sandboxId: sandbox.id,
    language: "python-3.12",
    code: problem.stub,
  });

  DB.appendTranscript({
    sessionId,
    who: "system",
    kind: "system",
    body: `Session started · sandbox ${sandbox.id}`,
  });

  return { sessionId, bodhiUserId, problem };
}

export function getSandbox(sessionId: string): Sandbox | undefined {
  return sandboxes.get(sessionId);
}

export async function destroySandbox(sessionId: string): Promise<void> {
  const sb = sandboxes.get(sessionId);
  if (!sb) return;
  try {
    await sb.destroy();
  } finally {
    sandboxes.delete(sessionId);
  }
}

export async function endSession(sessionId: string) {
  await destroySandbox(sessionId);
  DB.endSession(sessionId);
  DB.appendTranscript({
    sessionId,
    who: "system",
    kind: "system",
    body: "Session ended",
  });
}

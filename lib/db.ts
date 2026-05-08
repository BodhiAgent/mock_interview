import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const dbPath = path.join(DB_DIR, "mock_interview.db");

let _db: Database.Database | null = null;

function db(): Database.Database {
  if (_db) return _db;
  const d = new Database(dbPath);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  d.exec(`
    CREATE TABLE IF NOT EXISTS session (
      id           TEXT PRIMARY KEY,
      problem_id   TEXT NOT NULL,
      bodhi_user_id TEXT NOT NULL,
      sandbox_id   TEXT,
      language     TEXT NOT NULL DEFAULT 'python-3.12',
      code         TEXT NOT NULL DEFAULT '',
      status       TEXT NOT NULL DEFAULT 'live',
      started_at   INTEGER NOT NULL,
      ended_at     INTEGER
    );

    CREATE TABLE IF NOT EXISTS transcript_event (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
      ts          INTEGER NOT NULL,
      who         TEXT NOT NULL,
      kind        TEXT NOT NULL DEFAULT 'speech',
      body        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_transcript_session ON transcript_event(session_id, ts);

    CREATE TABLE IF NOT EXISTS run (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
      ts          INTEGER NOT NULL,
      kind        TEXT NOT NULL,
      stdout      TEXT NOT NULL DEFAULT '',
      stderr      TEXT NOT NULL DEFAULT '',
      exit_code   INTEGER,
      duration_ms INTEGER,
      passed      INTEGER,
      total       INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_run_session ON run(session_id, ts);
  `);
  _db = d;
  return d;
}

export type SessionRow = {
  id: string;
  problem_id: string;
  bodhi_user_id: string;
  sandbox_id: string | null;
  language: string;
  code: string;
  status: "live" | "ended" | "errored";
  started_at: number;
  ended_at: number | null;
};

export type TranscriptRow = {
  id: number;
  session_id: string;
  ts: number;
  who: "bodhi" | "iv" | "system";
  kind: "speech" | "tool" | "system";
  body: string;
};

export type RunRow = {
  id: number;
  session_id: string;
  ts: number;
  kind: "run" | "submit";
  stdout: string;
  stderr: string;
  exit_code: number | null;
  duration_ms: number | null;
  passed: number | null;
  total: number | null;
};

export function createSession(args: {
  id: string;
  problemId: string;
  bodhiUserId: string;
  sandboxId: string | null;
  language: string;
  code: string;
}) {
  db()
    .prepare(
      `INSERT INTO session (id, problem_id, bodhi_user_id, sandbox_id, language, code, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(args.id, args.problemId, args.bodhiUserId, args.sandboxId, args.language, args.code, Date.now());
}

export function getSession(id: string): SessionRow | undefined {
  return db().prepare(`SELECT * FROM session WHERE id = ?`).get(id) as SessionRow | undefined;
}

export function updateSessionCode(id: string, code: string) {
  db().prepare(`UPDATE session SET code = ? WHERE id = ?`).run(code, id);
}

export function endSession(id: string) {
  db().prepare(`UPDATE session SET status = 'ended', ended_at = ? WHERE id = ?`).run(Date.now(), id);
}

export function appendTranscript(args: {
  sessionId: string;
  who: "bodhi" | "iv" | "system";
  kind?: "speech" | "tool" | "system";
  body: string;
}) {
  return db()
    .prepare(
      `INSERT INTO transcript_event (session_id, ts, who, kind, body) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(args.sessionId, Date.now(), args.who, args.kind ?? "speech", args.body);
}

export function listTranscript(sessionId: string): TranscriptRow[] {
  return db()
    .prepare(`SELECT * FROM transcript_event WHERE session_id = ? ORDER BY ts ASC, id ASC`)
    .all(sessionId) as TranscriptRow[];
}

export function recordRun(args: {
  sessionId: string;
  kind: "run" | "submit";
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  passed?: number | null;
  total?: number | null;
}): number {
  const r = db()
    .prepare(
      `INSERT INTO run (session_id, ts, kind, stdout, stderr, exit_code, duration_ms, passed, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      args.sessionId,
      Date.now(),
      args.kind,
      args.stdout,
      args.stderr,
      args.exitCode,
      args.durationMs,
      args.passed ?? null,
      args.total ?? null,
    );
  return Number(r.lastInsertRowid);
}

export function listRuns(sessionId: string): RunRow[] {
  return db()
    .prepare(`SELECT * FROM run WHERE session_id = ? ORDER BY ts DESC LIMIT 50`)
    .all(sessionId) as RunRow[];
}

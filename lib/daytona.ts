/**
 * Daytona sandbox wrapper.
 *
 * If DAYTONA_API_KEY is set, uses @daytonaio/sdk to create a real sandbox
 * per session and run code remotely. If unset, falls back to executing Python
 * locally in a temp dir so the app remains end-to-end runnable for development.
 *
 * SDK shape verified against @daytonaio/sdk@0.27:
 *   - daytona.create({ language, ... }) → Sandbox
 *   - sandbox.fs.uploadFile(Buffer, "/path/to/file")
 *   - sandbox.process.executeCommand(cmd, cwd, env?, timeoutSec) → { result, exitCode }
 *   - sandbox.delete()
 */

import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import crypto from "node:crypto";

export type ExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
};

export type Sandbox = {
  id: string;
  writeFile: (relPath: string, contents: string) => Promise<void>;
  exec: (cmd: string, opts?: { cwd?: string; timeoutMs?: number }) => Promise<ExecResult>;
  destroy: () => Promise<void>;
};

const DAYTONA_KEY = process.env.DAYTONA_API_KEY?.trim();

export function isUsingDaytona(): boolean {
  return Boolean(DAYTONA_KEY);
}

export async function createSandbox(): Promise<Sandbox> {
  if (DAYTONA_KEY) {
    try {
      return await createDaytonaSandbox();
    } catch (e) {
      console.error("[daytona] create failed; falling back to local sandbox:", e);
      return createLocalSandbox();
    }
  }
  return createLocalSandbox();
}

/* ──────────────────── Daytona-backed implementation ──────────────────── */

type DaytonaSDK = {
  Daytona: new (cfg: { apiKey: string; target?: string }) => DaytonaClient;
};
type DaytonaClient = {
  create: (params?: {
    language?: "python" | "typescript" | "javascript";
    image?: string;
    labels?: Record<string, string>;
    autoStopInterval?: number;
    autoDeleteInterval?: number;
    ephemeral?: boolean;
  }) => Promise<DaytonaSandboxLike>;
};
type DaytonaSandboxLike = {
  id: string;
  fs: {
    uploadFile: (source: Buffer | string, destination: string, timeoutSec?: number) => Promise<void>;
    createFolder?: (path: string, mode?: string) => Promise<void>;
  };
  process: {
    executeCommand: (
      command: string,
      cwd?: string,
      env?: Record<string, string>,
      timeoutSec?: number,
    ) => Promise<{ result?: string; exitCode?: number; output?: string }>;
  };
  getRootDir: () => Promise<string>;
  delete: () => Promise<void>;
};

async function createDaytonaSandbox(): Promise<Sandbox> {
  const mod = (await import("@daytonaio/sdk")) as unknown as DaytonaSDK;
  const client = new mod.Daytona({
    apiKey: DAYTONA_KEY!,
    target: process.env.DAYTONA_TARGET || undefined,
  });

  const remote = await client.create({
    language: "python",
    autoStopInterval: 60, // stop after 60 min idle
    autoDeleteInterval: 60 * 24, // delete after 24h
  });

  const rootDir = await remote.getRootDir();

  return {
    id: remote.id,

    writeFile: async (rel, contents) => {
      const dst = path.posix.join(rootDir, rel);
      await remote.fs.uploadFile(Buffer.from(contents, "utf8"), dst);
    },

    exec: async (cmd, opts) => {
      const t0 = Date.now();
      const cwd = opts?.cwd ? path.posix.join(rootDir, opts.cwd) : rootDir;
      const timeoutSec = Math.max(1, Math.ceil((opts?.timeoutMs ?? 10_000) / 1000));
      const r = await remote.process.executeCommand(cmd, cwd, undefined, timeoutSec);
      // SDK merges stdout+stderr into `result`. We surface it as stdout when the
      // command succeeded and as stderr otherwise so the UI's red styling kicks in.
      const out = r.result ?? r.output ?? "";
      const exit = r.exitCode ?? 0;
      return {
        stdout: exit === 0 ? out : "",
        stderr: exit !== 0 ? out : "",
        exitCode: exit,
        durationMs: Date.now() - t0,
      };
    },

    destroy: async () => {
      try {
        await remote.delete();
      } catch (e) {
        console.warn("[daytona] sandbox.delete() failed:", e);
      }
    },
  };
}

/* ──────────────────── Local fallback implementation ──────────────────── */

async function createLocalSandbox(): Promise<Sandbox> {
  const id = `local-${crypto.randomBytes(4).toString("hex")}`;
  const root = path.join(os.tmpdir(), "bodhi-mockint", id);
  await fs.mkdir(root, { recursive: true });

  return {
    id,
    writeFile: async (rel, contents) => {
      const full = path.join(root, rel);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, contents, "utf8");
    },
    exec: async (cmd, opts) => {
      const t0 = Date.now();
      const cwd = opts?.cwd ? path.join(root, opts.cwd) : root;
      const timeoutMs = opts?.timeoutMs ?? 10_000;
      return new Promise<ExecResult>((resolve) => {
        const child = spawn("/bin/sh", ["-c", cmd], {
          cwd,
          env: { ...process.env, PYTHONUNBUFFERED: "1" },
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => (stdout += d.toString()));
        child.stderr.on("data", (d) => (stderr += d.toString()));
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          stderr += `\n[runtime exceeded ${timeoutMs}ms — killed]`;
        }, timeoutMs);
        child.on("close", (code) => {
          clearTimeout(timer);
          resolve({
            stdout,
            stderr,
            exitCode: code ?? -1,
            durationMs: Date.now() - t0,
          });
        });
        child.on("error", (e) => {
          clearTimeout(timer);
          resolve({
            stdout,
            stderr: stderr + `\n[spawn error] ${e.message}`,
            exitCode: -1,
            durationMs: Date.now() - t0,
          });
        });
      });
    },
    destroy: async () => {
      await fs.rm(root, { recursive: true, force: true }).catch(() => {});
    },
  };
}

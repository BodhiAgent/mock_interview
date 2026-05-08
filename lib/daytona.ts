/**
 * Daytona sandbox wrapper.
 *
 * If DAYTONA_API_KEY is set, uses the @daytonaio/sdk to create a real sandbox
 * per session and run code remotely. If unset, falls back to executing Python
 * locally in a temp dir so the app remains end-to-end runnable for development.
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
    return createDaytonaSandbox();
  }
  return createLocalSandbox();
}

/* ──────────────────── Daytona-backed implementation ──────────────────── */

async function createDaytonaSandbox(): Promise<Sandbox> {
  // Lazy-import so the SDK is only loaded when actually used.
  // The shape below matches the documented surface in DESIGN.md / daytona docs.
  // If the SDK contract differs at runtime, errors surface to the route handler
  // which renders them in the browser console pane.
  const mod = await import("@daytonaio/sdk").catch(() => null);
  if (!mod) {
    console.warn("[daytona] @daytonaio/sdk not installed — falling back to local sandbox");
    return createLocalSandbox();
  }

  // The SDK exposes a default class; instantiate with the API key.
  const Daytona = (mod as { Daytona?: new (cfg: { apiKey: string }) => unknown }).Daytona;
  if (!Daytona) {
    console.warn("[daytona] SDK shape unexpected — falling back to local sandbox");
    return createLocalSandbox();
  }
  const client = new Daytona({ apiKey: DAYTONA_KEY! }) as {
    create: (opts?: unknown) => Promise<DaytonaSandboxLike>;
  };

  const remote = await client.create({
    image: "python:3.12-slim",
    cpu: 1,
    memory: 1,
  });

  return {
    id: String(remote.id ?? `daytona-${Date.now()}`),
    writeFile: async (rel, contents) => {
      const target = path.posix.join("/work", rel);
      // Some SDK versions: sandbox.fs.writeFile(path, contents)
      if (remote.fs?.writeFile) {
        await remote.fs.writeFile(target, contents);
      } else if (remote.process?.exec) {
        // Fallback: heredoc into the file if no fs API.
        const escaped = contents.replace(/'/g, `'\\''`);
        await remote.process.exec(`mkdir -p $(dirname ${target}) && printf '%s' '${escaped}' > ${target}`);
      } else {
        throw new Error("Daytona SDK exposes neither fs.writeFile nor process.exec");
      }
    },
    exec: async (cmd, opts) => {
      const t0 = Date.now();
      if (!remote.process?.exec) throw new Error("Daytona SDK is missing process.exec");
      const r = await remote.process.exec(cmd, { cwd: opts?.cwd ?? "/work", timeout: opts?.timeoutMs });
      return {
        stdout: r.stdout ?? "",
        stderr: r.stderr ?? "",
        exitCode: r.exitCode ?? 0,
        durationMs: Date.now() - t0,
      };
    },
    destroy: async () => {
      try {
        if (remote.delete) await remote.delete();
        else if (remote.destroy) await remote.destroy();
      } catch (e) {
        console.warn("[daytona] destroy failed:", e);
      }
    },
  };
}

type DaytonaSandboxLike = {
  id?: string;
  fs?: { writeFile?: (path: string, contents: string) => Promise<void> };
  process?: {
    exec: (cmd: string, opts?: { cwd?: string; timeout?: number }) => Promise<{
      stdout?: string;
      stderr?: string;
      exitCode?: number;
    }>;
  };
  delete?: () => Promise<void>;
  destroy?: () => Promise<void>;
};

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

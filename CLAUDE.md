# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install       # required after clone — installs deps & compiles better-sqlite3 native binding
pnpm dev           # Next.js dev server on :3000
pnpm build         # production build (also type-checks)
pnpm start         # serve the production build
pnpm lint          # next lint (no custom config; uses Next defaults)
```

There is **no test suite** yet. Don't invent one without being asked.

`better-sqlite3` requires its postinstall to run; the `pnpm.onlyBuiltDependencies` block in `package.json` allows it. If you ever see "Could not locate the bindings file," rerun `pnpm install` (not `pnpm rebuild`, which doesn't trigger the install script under pnpm's strict mode).

The SQLite file lives at `data/mock_interview.db` and is gitignored. Delete it to reset all sessions and transcripts.

## Architecture

This is a Next.js 15 App Router app that orchestrates two third parties: **bodhiagent.live** (voice interviewee) and **Daytona** (code-execution sandbox). The app itself is a thin shell around three real-time channels.

### Data flow during a live session

```
Browser ──ws (audio + transcript)──▶ wss://bodhiagent.live/ws?userId=…   (direct, no proxy)
Browser ──HTTP/SSE────────────────▶ Next.js route handlers ──▶ Daytona / local Python
SQLite (data/*.db) ◀── source of truth for code, transcript, runs
```

- The **Bodhi WebSocket is opened from the browser**, not proxied through our backend. `lib/useBodhi.ts` is the only client of that protocol; if you change the Bodhi wire format, change it there.
- **Run output streams as SSE** from `app/api/sessions/[id]/run/route.ts`. The client parses `data: {…}\n\n` frames in `SessionView.handleRun`.
- The Bodhi protocol isn't fully documented; `useBodhi` accepts any incoming JSON with a `text|transcript|message|content` field as a turn. Don't assume more structure than that.

### Sandbox lifecycle (the load-bearing detail)

`lib/session.ts` keeps an **in-memory `Map<sessionId, Sandbox>`**, pinned to `globalThis.__bodhiSandboxes`. The sandbox handle is not serializable, so it lives only in this Node process.

- **Pinning to `globalThis` is required**, not stylistic. Next.js dev mode bundles each route handler with its own webpack module graph, so a plain `const sandboxes = new Map()` at module scope ends up duplicated and the `/run` route can't see the sandbox that `/sessions` created. Don't undo this without testing both endpoints in dev.
- **Creating a session** allocates the sandbox eagerly and seeds `solution.py` + `tests.py` from `lib/problems.ts`.
- **A server restart drops live sandboxes**, even though the session row in SQLite still says `status='live'`. Subsequent `/run` requests return `410 sandbox_unavailable`. (HMR no longer drops them since the globalThis fix.) The design doc (`docs/DESIGN.md` §7) proposes Cloudflare Durable Objects to fix server-restart drops in v2.
- `lib/daytona.ts` switches between a real Daytona sandbox (when `DAYTONA_API_KEY` is set) and a local Python tempdir fallback. Both implement the same `Sandbox` shape: `writeFile`, `exec`, `destroy`. Don't add Daytona-specific methods to the wrapper without giving the local impl an equivalent.
- The Daytona SDK call shapes used (verified against `@daytonaio/sdk@0.27`): `daytona.create({ language: "python" })` → `Sandbox`; `sandbox.fs.uploadFile(Buffer, dst)`; `sandbox.process.executeCommand(cmd, cwd, env, timeoutSec)` returning `{ result, exitCode }` (stdout+stderr **merged into `result`** — the wrapper splits them by exit code); `sandbox.delete()`.

### Why API routes use the Node runtime

Every route handler in `app/api/**/route.ts` has `export const runtime = "nodejs"`. This is required because:
- `better-sqlite3` is a native binding (Edge runtime can't load it)
- The local sandbox uses `child_process.spawn`
- The Daytona SDK ships a CommonJS-leaning bundle

If you add a new route handler, keep `runtime = "nodejs"`.

### Server vs. client component split

- Pages under `app/` are **server components** that read SQLite directly via `lib/db.ts` and pass plain data to `"use client"` views.
- `app/session/[id]/SessionView.tsx` is the only large client component; it owns Monaco, the SSE reader, and the Bodhi hook. The corresponding `page.tsx` does just hydration + 404 handling.
- **Hydration matters here**: any client component that calls `Date.now()` or `Math.random()` during render must defer that to `useEffect` (see `Topbar.tsx`'s timer and `BodhiPanel.tsx`'s `Wave` component for the pattern). SSR will run the render once on the server with different values than the client.

### Problem definitions

`lib/problems.ts` is a hand-written catalog of 5 problems. Each problem ships:
- a `stub` (initial editor contents, written to `solution.py` in the sandbox),
- a `testRunner` (written to `tests.py`, executed by `Submit`).

The `Submit` route parses `tests.py`'s stdout as JSON to extract `{passed, total}`. The convention is enforced by every problem's `testRunner` printing exactly `json.dumps({"passed": …, "total": …, "results": [...]}, indent=2)` and exiting non-zero on failure. Keep this contract intact when adding problems.

### Visual reference

`docs/reference.html` is the original prototype. The React port in `app/`, `components/`, and `app/globals.css` matches its visual language exactly — same CSS variables, same class names. When changing styles, both should stay in sync, or `docs/reference.html` should be deleted.

`docs/DESIGN.md` is the full design doc; treat it as authoritative for direction (§11 cost envelope, §12 roadmap) but stale for implementation details that have shipped (consult the actual code first).

## Path alias

`@/*` resolves to the repo root, e.g. `import { listProblems } from "@/lib/problems"`. Configured in `tsconfig.json`.

## Environment

Both env vars are optional — see `.env.example`. The app runs without them (local Python sandbox, public Bodhi WS).

# Bodhi · Mock Interview

A live coding-interview studio. You play the **interviewer**; **Bodhi** is the AI candidate — narrating its approach over voice while typing into a real editor. Code runs in a Daytona sandbox (or a local Python fallback) and the entire transcript is saved for replay.

- **Voice agent:** [bodhiagent.live](https://bodhiagent.live) over WebSocket.
- **Sandbox:** [Daytona](https://www.daytona.io) — sub-90 ms creation, isolated execution.
- **Editor:** Monaco (the VS Code editor), Python by default.

## Quick start

```bash
pnpm install                        # installs deps & compiles better-sqlite3
cp .env.example .env.local          # paste your DAYTONA_API_KEY (optional)
pnpm dev                            # http://localhost:3000
```

Pick a problem, click **Start session**, and the app:

1. Creates a sandbox — Daytona (`daytona.create({ language: "python" })`) if `DAYTONA_API_KEY` is set, otherwise a local Python tempdir.
2. Uploads the problem stub (`solution.py`) and hidden test runner (`tests.py`) into the sandbox.
3. Opens a WebSocket from the browser directly to `wss://bodhiagent.live/ws?userId=…`.
4. Renders the interview screen (`app/session/[id]`).

`Run` executes `python solution.py`; `Submit` runs `python tests.py` and parses its JSON output for pass/fail counts. Output streams back as Server-Sent Events.

End-to-end verified against Daytona: sandbox creation → stub upload → submit → 3/3 passing in ~150 ms.

## Environment

| Var | Required | Notes |
|---|---|---|
| `DAYTONA_API_KEY` | optional | If set, sessions use a real Daytona sandbox. Otherwise the app spawns Python locally via `child_process`. |
| `DAYTONA_TARGET`  | optional | Region passed to the SDK (`us`, `eu`, …). |
| `BODHI_WS_URL`    | optional | Defaults to `wss://bodhiagent.live/ws`. |

Sandboxes are created with `autoStopInterval: 60` and `autoDeleteInterval: 24 h`, so orphans (server crashes, dev-mode handle drops) clean themselves up — but you'll still pay a few cents/hr until they do. Shorten the intervals in `lib/daytona.ts` if it gets noisy.

## Project layout

```
app/
  page.tsx                          # catalog
  session/[id]/page.tsx             # live session (server)
  session/[id]/SessionView.tsx      # live session (client)
  session/[id]/replay/page.tsx      # post-session replay
  api/
    problems/route.ts               # GET catalog
    sessions/route.ts               # POST create
    sessions/[id]/route.ts          # GET hydrate · PATCH code
    sessions/[id]/run/route.ts      # POST run/submit, SSE stream
    sessions/[id]/transcript/route.ts
    sessions/[id]/end/route.ts
components/
  Topbar.tsx, Rail.tsx
  session/ProblemPane.tsx
  session/CodeLab.tsx               # Monaco wrapper
  session/BodhiPanel.tsx            # voice + transcript + controls
lib/
  problems.ts                       # 5 hardcoded problems
  daytona.ts                        # sandbox abstraction (Daytona | local)
  session.ts                        # in-memory sandbox map + DB writes
  db.ts                             # better-sqlite3 (file: data/mock_interview.db)
  useBodhi.ts                       # voice WS hook
docs/
  DESIGN.md                         # full design doc
  reference.html                    # original visual prototype
```

## What's in the MVP

- ✅ Catalog of 5 Python problems (Easy → Hard)
- ✅ Live session view: editor + Bodhi panel + sandbox runs
- ✅ Real Daytona integration (`@daytonaio/sdk@0.27`) with a local Python fallback
- ✅ Bodhi WS connection + reconnect-with-backoff + typed-input fallback
- ✅ SQLite-backed transcript + run history
- ✅ Mute / End-call / Replay
- ✅ ⌘↵ to Run, ⇧⌘↵ to Submit

## What's deferred (see `docs/DESIGN.md`)

- Multi-language (TS / Go / Rust). Editor is locked to Python.
- LSP round-trip through Daytona.
- Microphone audio streaming. The Bodhi WS is wired for text turns; voice audio plumbing requires Bodhi's WebRTC details which weren't public at build time.
- Cloudflare Durable Objects orchestration. The MVP keeps sandbox handles in-process (pinned to `globalThis`); a server restart drops live sandboxes (transcripts persist in SQLite).

## Notes on the Bodhi integration

The hook in `lib/useBodhi.ts` opens a WebSocket directly from the browser to `wss://bodhiagent.live/ws?userId=<id>` and accepts any incoming JSON with a `text`, `transcript`, `message`, or `content` field as a Bodhi turn. If the protocol differs from this shape, either the upstream payload format has changed or audio framing dominates the channel — see `docs/DESIGN.md` §5 for how to extend.

If the WS is offline, the panel degrades gracefully: the typed-question fallback still saves to the transcript so you can dry-run the UI without voice.

## Notes on the Daytona integration

`lib/daytona.ts` wraps `@daytonaio/sdk@0.27` with a `Sandbox` interface (`writeFile`, `exec`, `destroy`) so the rest of the app doesn't care which backend it's talking to.

Mapping to the real SDK:

- `daytona.create({ language: "python", autoStopInterval, autoDeleteInterval })` → `Sandbox`
- `sandbox.fs.uploadFile(Buffer.from(contents), absPath)` for `writeFile`
- `sandbox.process.executeCommand(cmd, cwd, env, timeoutSec)` for `exec` — the SDK merges stdout+stderr into a single `result` field, which the wrapper splits by exit code
- `sandbox.delete()` for teardown

The same shape is implemented over `child_process.spawn` for the local fallback so both paths look identical to the route handlers.

# Mock Coding Interview — Design Doc

**Status:** Draft v1 · 2026-05-08
**Owner:** TBD
**Visual reference:** `index.html` in this repo (minimalist tech style, dark mode)

---

## 1. Overview

A web app that simulates a real coding interview. The candidate (the *user*) is the **interviewer**. Bodhi is the **interviewee**: a voice AI that thinks out loud, writes code in a real editor, runs it in a sandbox, and reacts to the user's questions and pushback over an open audio channel.

Two third-party services do the heavy lifting:

| Capability | Provider | Why |
|---|---|---|
| Voice agent (interviewee) | **bodhiagent.live** | First-party voice agent; WebSocket + phone bridge; open-source npm package |
| Code execution sandbox + editor backend | **daytona.io** | Sub-90 ms sandbox creation, multi-language, LSP, snapshots, web terminal |

The app is a thin orchestration layer that joins those two together inside one screen.

### Goals

- A live, voice-driven interview where the candidate hears Bodhi reason through the problem.
- Real code execution against test cases — not mocked.
- Editor experience that holds up to a 45-minute session (LSP, syntax highlighting, multiple files).
- Session can be replayed: transcript + code history are both persisted.
- Sub-1-second time-to-first-keystroke after the candidate clicks "Start session."

### Non-goals (v1)

- Multiple simultaneous interviewees.
- Phone-only mode (the dial-in number is a fallback, not the primary surface).
- Interviewee scoring / leaderboard.
- Custom agent authoring inside our app — point users at Bodhi's Agent Studio for that.

---

## 2. Personas & user flow

**Single persona (v1):** an engineering hiring manager or interview coach who wants to dry-run a problem against a "candidate" before using it on a real human.

```
1. Land on /                   →  pick problem from catalog
2. Click "Start session"       →  we spin up a Daytona sandbox & open a Bodhi WS call
3. Read problem, talk          →  Bodhi narrates approach, types into the editor
4. "Run code" / "Submit"       →  Daytona executes, results stream back to UI + voice
5. End session                 →  transcript + final code + run log saved to /sessions/:id
```

The screen shown in `index.html` is the live session view (step 3–4).

---

## 3. System architecture

```
                ┌────────────────────────────────────────────┐
                │              Browser (Next.js)             │
                │  ┌────────────┐  ┌────────────┐  ┌───────┐ │
                │  │  Problem   │  │   Editor   │  │ Bodhi │ │
                │  │   pane     │  │  (Monaco)  │  │ panel │ │
                │  └────────────┘  └─────┬──────┘  └───┬───┘ │
                │                        │             │     │
                │                        ▼             ▼     │
                │                   ws:///sandbox  wss://     │
                │                                 bodhiagent  │
                └─────────────┬──────────────────────┬───────┘
                              │                      │
                              ▼                      ▼
                ┌──────────────────────┐   ┌──────────────────────┐
                │  Our backend (Edge)  │   │   bodhiagent.live    │
                │   - session store    │   │   WebSocket realtime │
                │   - daytona broker   │◀──│  (audio + tool calls)│
                │   - websocket relay  │   └──────────────────────┘
                └──────────┬───────────┘
                           │ HTTPS
                           ▼
                ┌──────────────────────┐
                │     daytona.io       │
                │  Sandbox + LSP +     │
                │  process exec        │
                └──────────────────────┘
```

Three real-time channels active during a session:

1. **Browser ⇄ our backend** (WebSocket): editor diffs, run-code requests, session state.
2. **Browser ⇄ bodhiagent.live** (WebSocket, direct): audio streaming + agent tool-call events.
3. **Our backend ⇄ Daytona** (HTTPS + WebSocket): sandbox lifecycle and process I/O streaming.

Bodhi's tool-calls travel back through *our* backend so we can intercept "edit code" / "run code" actions and forward them to Daytona (more in §6).

---

## 4. Frontend

### 4.1 Stack

- **Next.js 15** (App Router) on the edge for low TTFB.
- **React 19** + **TypeScript** strict.
- **Monaco Editor** (`@monaco-editor/react`) for the code lab — already used by VS Code, supports LSP via webworkers.
- **Geist** + **Geist Mono** typography (matches `index.html`).
- **Zustand** for session state; **TanStack Query** for HTTP.
- **Bodhi npm package** (`bodhiagent` — see §5) for the voice channel.

### 4.2 Routes

| Route | Purpose |
|---|---|
| `/` | Catalog of problems + "New session" CTA |
| `/session/[id]` | Live interview screen (matches `index.html`) |
| `/session/[id]/replay` | Read-only timeline replay |
| `/admin/problems` | (Internal) problem authoring |

### 4.3 Live session layout

Already designed in `index.html`. Four columns:

1. **Rail** (48 px) — problem / submissions / notes / discussions / console tabs.
2. **Problem** (~36%) — description, examples, constraints, hints from Bodhi.
3. **Editor** (flex) — Monaco with file tabs, language picker, run/submit footer.
4. **Bodhi** (340 px) — avatar, status, waveform, live transcript, call controls.

### 4.4 Editor wiring

```ts
// pseudo-code
const ed = useMonaco();
ed.onDidChangeModelContent(debounce(diff =>
  ws.send({ type: 'edit', file, ops: diff }), 80));

bodhiTool.on('apply_edit', ({ file, range, text }) =>
  ed.executeEdits('bodhi', [{ range, text, forceMoveMarkers: true }]));
```

Bodhi *types into the editor* as part of its narration. We treat its tool-calls as remote edits and animate them character-by-character so it looks human (~40 chars/sec).

---

## 5. Bodhi voice agent integration

### 5.1 What bodhiagent.live exposes (observed)

- WebSocket endpoint: `wss://bodhiagent.live/ws?userId=<clientId>`
- A "Standard agent" plus alt agents (Claude Code, NanoClaw) selectable per session.
- npm package (open source) for embedding the call widget / driving the WS.
- Phone bridge fallback: **+1 (650) 668-4085**.
- Agent Studio for authoring custom agents — out of scope for v1, but we point power users there.

### 5.2 Our integration

```
┌──────────────────────────────────────────────────────────┐
│   <BodhiPanel />  (React component)                      │
│                                                          │
│   const bodhi = useBodhi({                               │
│     agent: 'mock-interviewee-v1',                        │
│     userId: session.id,                                  │
│     tools: { applyEdit, runCode, askProblem },           │
│     onTranscript: msg => transcriptStore.append(msg),    │
│     onAudioLevel: db => waveStore.set(db),               │
│     onStatus: s => setStatus(s),                         │
│   });                                                    │
│                                                          │
│   <Avatar speaking={bodhi.status === 'speaking'} />      │
│   <Waveform levels={bodhi.audioLevels} />                │
│   <Transcript items={transcript} />                      │
│   <Controls onMute={bodhi.toggleMute}                    │
│             onEnd={bodhi.disconnect} />                  │
└──────────────────────────────────────────────────────────┘
```

We wrap the npm package in a `useBodhi` hook so the rest of the app never touches the WS directly. The hook owns:

- Microphone capture + echo cancellation.
- WebSocket reconnect-with-backoff.
- Tool-call dispatch (`applyEdit`, `runCode`, `askProblem`).
- Audio level sampling at 30 fps for the waveform.

### 5.3 Agent prompt / persona

We register a custom agent profile in Bodhi's Agent Studio called `mock-interviewee-v1`:

- Persona: senior IC, ~6 years experience, calm, narrates reasoning.
- System prompt loaded with the active problem at session start.
- Tools made available to the agent:
  - `apply_edit({ file, range, text })` — edit the candidate's editor.
  - `run_code({ stdin? })` — execute current file in the sandbox.
  - `ask_clarifying({ question })` — push a transcript message and pause.

If Bodhi's open-source repo doesn't yet support custom tool registration over its WS protocol, we proxy: tools are declared on *our* backend, Bodhi requests them via tool-call events, and we relay to Daytona.

### 5.4 Failure modes

| Failure | Mitigation |
|---|---|
| WS drops mid-session | Auto-reconnect with last `userId`; resume transcript from local cache |
| Audio device denied | Fallback to text-only; show banner "Voice unavailable — Bodhi will type" |
| Bodhi outage (5xx on connect) | Show dial-in card with `+1 (650) 668-4085` + a "Continue without voice" button |

---

## 6. Daytona sandbox integration

### 6.1 What Daytona offers (observed)

- Python SDK first; HTTPS API also available.
- Sub-90 ms sandbox creation.
- `sandbox.process.exec(cmd)` with streaming stdout/stderr.
- File CRUD, git, LSP, snapshots, multi-region.
- Pricing: $0.0504/vCPU-hr, $0.0162/GiB-RAM-hr — an idle interview-size sandbox is roughly $0.07/hr.

### 6.2 Lifecycle

```
on session start:
  sandbox = await daytona.create({
    image: 'mockinterview/python-3.12:latest',
    cpu: 1, memoryGiB: 1,
    region: nearestTo(user),
    snapshotId: problem.snapshotId,   // pre-warmed with stdlib + tests
    idleTimeoutSec: 60 * 60,
  });
  await sandbox.fs.writeFile('/work/solution.py', problem.stub);

on edit:
  // we don't push every keystroke; debounce 200 ms, then sync file
  await sandbox.fs.writeFile('/work/solution.py', editor.getValue());

on runCode:
  const stream = sandbox.process.exec('python /work/solution.py', { stdin });
  for await (const chunk of stream) { ws.send({ type:'stdout', chunk }) }

on submit:
  return sandbox.process.exec('python -m pytest /work/tests.py -q --json');

on session end:
  await sandbox.snapshot();   // for replay
  await sandbox.destroy();
```

### 6.3 Why a fresh sandbox per session (not per user)

- Each problem has different fixtures and dependencies.
- Cheaper to destroy than to clean up after Bodhi runs `rm -rf /` "to test edge cases."
- Snapshotting on end gives us deterministic replay.

### 6.4 Multi-language

Problem definitions declare `runtimes: ['python-3.12', 'typescript', 'go-1.22']`. We pre-bake one snapshot per (problem, runtime) pair and select at session start based on the language picker in the editor toolbar.

---

## 7. Backend (our orchestrator)

### 7.1 Stack

- **Next.js Route Handlers** (Edge) for HTTP, plus **Cloudflare Durable Objects** (or **Fly.io machines** if we prefer Node) for the WS relay — one DO instance per active session.
- **Postgres** (Neon) for problems, sessions, transcripts.
- **Redis** for ephemeral session state (current code, run results buffer).

### 7.2 Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/sessions` | Create session, allocate sandbox, return `sessionId` + Bodhi `userId` |
| `GET` | `/api/sessions/:id` | Hydrate page (problem, current code, transcript) |
| `WS` | `/api/sessions/:id/stream` | Editor diffs, run requests, server-pushed run output |
| `POST` | `/api/sessions/:id/run` | Trigger run (also reachable as a Bodhi tool-call) |
| `POST` | `/api/sessions/:id/submit` | Trigger submit; runs hidden test suite |
| `POST` | `/api/sessions/:id/end` | Terminate sandbox, snapshot, mark ended |
| `GET` | `/api/problems` | Catalog |

### 7.3 Tool-call routing

When Bodhi's WS sends a `tool_call` event:

```
bodhi WS  ──tool_call──▶  our DO  ──┬──▶ daytona.process.exec   (run_code)
                                    ├──▶ ws push to browser     (apply_edit)
                                    └──▶ DB insert + ws push    (ask_clarifying)
                                            │
                                            ▼
                                    bodhi WS ◀── tool_result
```

The DO is the trust boundary. Bodhi never gets direct sandbox creds.

---

## 8. Data model (simplified)

```sql
problem(
  id, slug, title, difficulty, body_md, examples_json,
  constraints_json, snapshot_python, snapshot_ts, ...
)

session(
  id, problem_id, user_id, started_at, ended_at,
  bodhi_user_id, sandbox_id, language, final_code,
  status  -- 'live' | 'ended' | 'errored'
)

transcript_event(
  id, session_id, ts, who,           -- 'bodhi' | 'interviewer'
  kind,                               -- 'speech' | 'tool' | 'system'
  body_text, body_json
)

run(
  id, session_id, ts, kind,           -- 'run' | 'submit'
  stdout, stderr, exit_code, duration_ms, passed_count
)
```

---

## 9. Key sequences

### 9.1 Session start

```
Browser                Backend(DO)            Daytona              Bodhi
   │ POST /sessions       │                      │                    │
   │ ────────────────────▶│ daytona.create()     │                    │
   │                      │ ────────────────────▶│                    │
   │                      │ ◀───── sandboxId ────│                    │
   │                      │ register agent profile w/ problem ───────▶│
   │                      │ ◀────── userId ──────────────────────────│
   │ ◀── {sessionId,      │                                            │
   │      bodhiUserId} ───│                                            │
   │                                                                  │
   │ open WS /sessions/:id/stream                                     │
   │ open WS wss://bodhiagent.live/ws?userId=...                      │
   │ ─── audio + tool events ◀──────────────────────────────────────▶ │
```

### 9.2 Bodhi runs the code

```
Bodhi  ── tool_call run_code ──▶ DO
DO     ── exec("python /work/solution.py") ──▶ Daytona
Daytona ── stdout chunks ──▶ DO
DO ── ws stream ──▶ Browser (renders in console pane)
DO ── tool_result(stdout, exit) ──▶ Bodhi  (so it can react in voice)
```

---

## 10. Security & abuse

- **Sandbox isolation:** Daytona handles process isolation; we never let user code reach our infra.
- **No outbound network from sandbox** by default. Whitelist only PyPI/npm for problems that need it.
- **Rate limit** session creation (1 active session per user, 10/day) — sandboxes cost real money.
- **Bodhi prompt injection:** problem text is rendered server-side as plain text into the agent's system prompt; we never feed user-supplied chat back into Bodhi without a guard.
- **Audio recording disclosure:** banner on session start; transcripts stored, raw audio not stored in v1.

---

## 11. Cost back-of-envelope (v1, 1k sessions/mo, ~30 min avg)

| Line | Calc | Monthly |
|---|---|---|
| Daytona compute (1 vCPU, 1 GiB) | 1k × 0.5 hr × ($0.0504+$0.0162) | ~$33 |
| Daytona storage (snapshots, 200 MB × 1k × 30 d) | $0.000108/GiB-hr × 200/1024 × 720 × 1000 | ~$15 |
| Bodhi voice (assume $0.10/min, ~25 min/session) | 1k × 25 × $0.10 | ~$2,500 |
| Postgres (Neon scale) | flat | ~$30 |
| Edge / CDN | flat | ~$20 |
| **Total** | | **~$2,600/mo** |

Voice dominates. Worth a follow-up to confirm Bodhi's actual per-minute pricing before launch.

---

## 12. Roadmap

### MVP (4 weeks)

- [ ] Static problem catalog (5 problems, Python only)
- [ ] Session view with editor + Bodhi voice + sandbox runs
- [ ] Transcript persistence
- [ ] Mute / end-call / replay-on-end

### V1.1

- [ ] Multi-language (TS, Go)
- [ ] Replay timeline (scrub through code + audio)
- [ ] Custom problem upload
- [ ] Interview report (LLM-generated summary of how Bodhi performed)

### V2

- [ ] Live interviewer mode — record yourself + Bodhi for sharing
- [ ] Hint policy / difficulty knobs (give Bodhi varying competence levels)
- [ ] Pair-mode (real human interviewer + Bodhi candidate over the same session)

---

## 13. Open questions

1. Does Bodhi's npm SDK support arbitrary tool registration over its current WS protocol, or do we need to upstream a PR / proxy?
2. Daytona LSP — does it round-trip through `monaco-languageclient` cleanly, or do we run a local web-worker LSP and only use Daytona for execution?
3. Audio storage — do we want raw audio for replay (legal review needed) or transcript-only?
4. Pricing of Bodhi voice minutes — needs to be confirmed before we announce a free tier.

---

## 14. Appendix — file map

```
mock_interview/
├── index.html              # visual reference, current minimalist design
├── DESIGN.md               # this doc
├── bodhi_with_avatar.png   # avatar asset
└── hackerrank_mock_UI.png  # original reference
```

When we move to Next.js the layout in `index.html` becomes `app/session/[id]/page.tsx` with the same DOM structure, just componentized.

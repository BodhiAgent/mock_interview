"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export type RunEvent =
  | { type: "start"; kind: "run" | "submit" }
  | { type: "stdout"; chunk: string }
  | { type: "stderr"; chunk: string }
  | { type: "done"; exitCode: number; durationMs: number; runId?: number; passed?: number | null; total?: number | null };

type Props = {
  initialCode: string;
  onCodeChange: (code: string) => void;
  onRun: (kind: "run" | "submit") => Promise<void>;
  isRunning: boolean;
  events: RunEvent[];
  bodhiConnected: boolean;
};

export function CodeLab({ initialCode, onCodeChange, onRun, isRunning, events, bodhiConnected }: Props) {
  const [customInput, setCustomInput] = useState(true);

  const handleMount = useCallback(
    (editor: unknown, monaco: { editor: { defineTheme: (n: string, t: unknown) => void; setTheme: (n: string) => void } }) => {
      monaco.editor.defineTheme("bodhi-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "comment", foreground: "5a5a5f", fontStyle: "italic" },
          { token: "keyword", foreground: "c084fc" },
          { token: "string", foreground: "84cc16" },
          { token: "number", foreground: "f59e0b" },
          { token: "type", foreground: "38bdf8" },
        ],
        colors: {
          "editor.background": "#0a0a0b",
          "editor.foreground": "#f5f5f6",
          "editor.lineHighlightBackground": "#0f0f10",
          "editorLineNumber.foreground": "#3a3a3f",
          "editorLineNumber.activeForeground": "#d4d4d6",
          "editorCursor.foreground": "#4d8dff",
          "editor.selectionBackground": "#1f1f23",
          "editorIndentGuide.background": "#1a1a1d",
          "editorGutter.background": "#0a0a0b",
        },
      });
      monaco.editor.setTheme("bodhi-dark");
    },
    [],
  );

  return (
    <section className="lab">
      <div className="lab-bar">
        <div className="filetabs">
          <div className="filetab active">
            <span className="dot" />
            solution.py
          </div>
          <div className="filetab">tests.py</div>
        </div>
        <select className="lang" defaultValue="Python 3.12" disabled>
          <option>Python 3.12</option>
        </select>
        <button className="iconbtn" title="Format" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <path d="M4 6h16M4 12h12M4 18h8" />
          </svg>
        </button>
      </div>

      <div className="editor-wrap">
        <Monaco
          height="100%"
          defaultLanguage="python"
          defaultValue={initialCode}
          onMount={handleMount}
          onChange={(v) => onCodeChange(v ?? "")}
          options={{
            fontFamily: '"Geist Mono", ui-monospace, monospace',
            fontSize: 13,
            lineHeight: 1.65,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderLineHighlight: "all",
            padding: { top: 12, bottom: 24 },
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            tabSize: 4,
            wordWrap: "off",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            renderWhitespace: "selection",
            automaticLayout: true,
          }}
        />
      </div>

      <div className="lab-foot">
        <button className="ghostbtn" type="button">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
            <path d="M12 3v12M7 8l5-5 5 5M5 21h14" />
          </svg>
          Upload File
        </button>
        <label className="checkrow" onClick={() => setCustomInput((v) => !v)}>
          <span className={`check ${customInput ? "on" : ""}`} />
          Test against custom input
        </label>
        <span className="spacer" />
        <button className="runbtn" type="button" onClick={() => onRun("run")} disabled={isRunning}>
          {isRunning ? "Running…" : "Run"}
          <span className="kbd">⌘↵</span>
        </button>
        <button className="submitbtn" type="button" onClick={() => onRun("submit")} disabled={isRunning}>
          Submit
        </button>
      </div>

      <Console events={events} />

      <div className="row-status">
        <span>
          <b>Python 3.12</b>
        </span>
        <span>UTF-8</span>
        <span>LF</span>
        <span>Spaces · 4</span>
        <span className={`live ${bodhiConnected ? "" : "disconnected"}`}>
          <span className="d" />
          {bodhiConnected ? "Bodhi connected" : "Bodhi offline"}
        </span>
      </div>
    </section>
  );
}

function Console({ events }: { events: RunEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="console">
        <div className="head">Console</div>
        <pre style={{ color: "var(--fg-3)" }}>Ready. Press Run to execute against your custom input, or Submit to run all hidden tests.</pre>
      </div>
    );
  }
  return (
    <div className="console">
      <div className="head">Console</div>
      {events.map((ev, i) => {
        if (ev.type === "stdout") return <pre key={i}>{ev.chunk}</pre>;
        if (ev.type === "stderr") return <pre key={i} className="err">{ev.chunk}</pre>;
        if (ev.type === "start") return <pre key={i} style={{ color: "var(--fg-3)" }}>$ {ev.kind === "submit" ? "python tests.py" : "python solution.py"}</pre>;
        if (ev.type === "done") {
          const ok = ev.exitCode === 0;
          const passLabel = typeof ev.passed === "number" && typeof ev.total === "number"
            ? ` · ${ev.passed}/${ev.total} passed`
            : "";
          return (
            <pre key={i} className={ok ? "ok" : "exit"}>
              {ok ? "✓" : "✗"} exit {ev.exitCode} · {ev.durationMs}ms{passLabel}
            </pre>
          );
        }
        return null;
      })}
    </div>
  );
}

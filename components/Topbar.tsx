"use client";

import { useEffect, useState } from "react";

type Props = {
  problemTitle: string;
  startedAt: number;
  onExit: () => void;
};

export function Topbar({ problemTitle, startedAt, onExit }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");

  return (
    <header className="topbar">
      <div className="brand">
        <div className="mark">B</div>
        <div>bodhi</div>
        <div className="div" />
        <div className="scope">Mock Interview</div>
      </div>
      <nav className="crumbs">
        <span>Algorithms</span>
        <span className="sep">/</span>
        <span className="now">{problemTitle}</span>
      </nav>
      <div className="top-right">
        <div className="timer">
          <span className="lbl">Elapsed</span>
          <span>
            <b>{mm}</b>:<b>{ss}</b>
          </span>
          <span className="total">/ 45:00</span>
        </div>
        <button className="iconbtn" title="Settings" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.6 1.6 0 00.3 1.7l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.7-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.7.3l-.1.1A2 2 0 113.5 17l.1-.1a1.6 1.6 0 00.3-1.7 1.6 1.6 0 00-1.5-1H2a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.7l-.1-.1A2 2 0 117 4.5l.1.1a1.6 1.6 0 001.7.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.7-.3l.1-.1A2 2 0 1119.6 7l-.1.1a1.6 1.6 0 00-.3 1.7v.1a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
          </svg>
        </button>
        <button className="ghostbtn" type="button" onClick={onExit}>
          Exit Session
        </button>
      </div>
    </header>
  );
}

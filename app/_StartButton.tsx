"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { problems: { slug: string; title: string }[] };

export function StartButton({ problems }: Props) {
  const router = useRouter();
  const [slug, setSlug] = useState(problems[0]?.slug ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    if (!slug) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemSlug: slug }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { sessionId: string };
      router.push(`/session/${data.sessionId}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <select
        className="lang"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        style={{ height: 36, minWidth: 240 }}
      >
        {problems.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.title}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="submitbtn"
        style={{ height: 36, padding: "0 20px" }}
        onClick={start}
        disabled={busy}
      >
        {busy ? "Starting…" : "Start session →"}
      </button>
      {err && <span style={{ color: "var(--red)", fontSize: 12 }}>Error: {err}</span>}
    </div>
  );
}

"use client";

export function Rail() {
  return (
    <aside className="rail">
      <button className="tab active" title="Problem" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M5 4h11l4 4v12H5z" />
          <path d="M16 4v4h4" />
        </svg>
      </button>
      <button className="tab" title="Submissions" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M4 6h16M4 12h10M4 18h16" />
        </svg>
      </button>
      <button className="tab" title="Notes" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M3 21V9l5-5h13v17z" />
          <path d="M8 4v5H3" />
        </svg>
      </button>
      <button className="tab" title="Discussions" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      </button>
      <button className="tab" title="Console" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M4 4h16v16H4z" />
          <path d="M7 9l3 3-3 3M13 15h4" />
        </svg>
      </button>
      <div className="spacer" />
      <button className="tab" title="Help" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5M12 17h.01" />
        </svg>
      </button>
    </aside>
  );
}

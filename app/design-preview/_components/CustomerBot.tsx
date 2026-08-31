'use client';

import { useState } from 'react';

// The assistant your CUSTOMERS talk to, on the business's own public
// pages - separate from the owner-facing assistant on the dashboard.
// Carries the business's own "G" mark, never Vanova's.
export default function CustomerBot() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="customer-bot-btn" aria-label="Ask us anything" onClick={() => setOpen((v) => !v)}>
        <span className="cb-avatar">G</span>
      </button>
      <div className={`customer-bot-panel${open ? ' open' : ''}`}>
        <div className="cbp-head">
          <span className="cb-avatar" style={{ width: 30, height: 30, fontSize: 13 }}>
            G
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Glow Salon</p>
            <p style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>Ask us anything</p>
          </div>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)' }}>
            ✕
          </button>
        </div>
        <div className="cbp-body">
          <div className="chat-row theirs">
            <div className="chat-bubble">Hi! Ask about services, hours, or just tell me what you&apos;d like to book.</div>
          </div>
          <div className="chat-row mine">
            <div className="chat-bubble">Do you do gel manicures?</div>
          </div>
          <div className="chat-row theirs">
            <div className="chat-bubble">Yes — 45 min, ₦8,000. Want me to book it?</div>
          </div>
        </div>
        <div className="cbp-foot">
          <input placeholder="Type a message…" readOnly />
        </div>
      </div>
    </>
  );
}

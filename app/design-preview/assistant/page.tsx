import AdminNav from '../_components/AdminNav';

export default function DesignPreviewAssistant() {
  return (
    <div>
      <AdminNav current="automate" />
      <div className="dash-shell">
        <div className="wrap" style={{ padding: 0, maxWidth: 700 }}>
          <div className="eyebrow">Automate</div>
          <h2 style={{ fontSize: 24, marginBottom: 16 }}>Assistant</h2>
          <div className="card card-pad" style={{ marginBottom: 18, fontSize: 13, color: 'var(--ink-soft)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--primary)', flexShrink: 0 }}>✓</span>
            <span>
              <b style={{ color: 'var(--ink)' }}>Nothing changes until you say yes.</b> Before it moves anything, it shows you exactly who is affected and their new times, first.
            </span>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="chat-transcript" style={{ marginBottom: 16 }}>
              <div className="chat-row mine">
                <div className="chat-bubble">I&apos;m out sick tomorrow 9am to 1pm</div>
              </div>
              <div className="chat-row theirs">
                <div className="chat-bubble">You have 2 bookings in that window — Amaka at 9:30, Tolu at 11:00. Move both to the next available slot?</div>
              </div>
              <div className="chat-row mine">
                <div className="chat-bubble">Yes</div>
              </div>
              <div className="chat-row theirs">
                <div className="chat-bubble">Done. Both customers have been messaged with their new times.</div>
              </div>
            </div>
            <div className="wire-input-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 14, margin: 0 }}>
              <input placeholder="Ask anything, or say what to move" readOnly />
              <button style={{ background: 'var(--primary)' }}>→</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

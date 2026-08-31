export default function DesignPreviewOnboarding() {
  return (
    <div className="auth-shell" style={{ alignItems: 'flex-start', paddingTop: 56 }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--primary)',
                color: 'var(--on-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              G
            </span>
            <span style={{ fontSize: 15 }}>Glow Salon</span>
          </div>
          <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Skip for now</span>
        </div>
        <h1 style={{ fontSize: 27, marginBottom: 8 }}>Let&apos;s set up your booking page</h1>
        <p className="lede" style={{ marginBottom: 24 }}>
          Answer a few questions here — no forms. Say as much or as little as you want in each message.
        </p>
        <div className="checklist">
          <div className="cl-item on">
            <span className="cl-dot">✓</span>Profile
          </div>
          <div className="cl-item on">
            <span className="cl-dot">✓</span>Services
          </div>
          <div className="cl-item">
            <span className="cl-dot" />Hours
          </div>
        </div>
        <div className="card card-pad">
          <div className="chat-transcript">
            <div className="chat-row theirs">
              <div className="chat-bubble">Hi! Let&apos;s get Glow Salon set up. What service should I add first?</div>
            </div>
            <div className="chat-row mine">
              <div className="chat-bubble">Gel manicures, 45 mins, 8k</div>
            </div>
            <div className="chat-row theirs">
              <div className="chat-bubble">Got it — Gel Manicure, 45 min, ₦8,000. Save it?</div>
            </div>
            <div className="chat-row mine">
              <div className="chat-bubble">Yes</div>
            </div>
            <div className="chat-row theirs">
              <div className="chat-bubble">Saved! Last step — what are your opening hours?</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

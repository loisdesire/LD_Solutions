import AdminNav from '../_components/AdminNav';

export default function DesignPreviewChannels() {
  return (
    <div>
      <AdminNav current="automate" />
      <div className="dash-shell">
        <div className="wrap" style={{ padding: 0, maxWidth: 640 }}>
          <h2 style={{ fontSize: 24, marginBottom: 4 }}>Channels</h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 20 }}>Where your assistant can actually reach customers.</p>
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="channel-row">
              <span className="avatar-sm" style={{ background: 'var(--accent-soft)' }}>
                W
              </span>
              <div style={{ flex: 1 }}>
                <b>Website chat</b>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Always on, no setup needed</div>
              </div>
              <span className="chip-live">Connected</span>
            </div>
            <div className="channel-row">
              <span className="avatar-sm" style={{ background: 'var(--accent-soft)' }}>
                T
              </span>
              <div style={{ flex: 1 }}>
                <b>Telegram</b>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>@glowsalon_bot</div>
              </div>
              <span className="chip-live">Connected</span>
            </div>
            <div className="channel-row" style={{ opacity: 0.55 }}>
              <span className="avatar-sm">Wa</span>
              <div style={{ flex: 1 }}>
                <b>WhatsApp</b>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Pending Meta approval</div>
              </div>
              <span className="chip-soon">Coming soon</span>
            </div>
            <div className="channel-row" style={{ opacity: 0.55, borderBottom: 'none' }}>
              <span className="avatar-sm">M</span>
              <div style={{ flex: 1 }}>
                <b>Messenger</b>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Pending Meta approval</div>
              </div>
              <span className="chip-soon">Coming soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

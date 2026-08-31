import AdminNav from '../_components/AdminNav';

const TABS = ['Business profile', 'Website content', 'Booking rules', 'Payments'];

export default function DesignPreviewSettings() {
  return (
    <div>
      <AdminNav current="business" />
      <div className="dash-shell">
        <div className="wrap" style={{ padding: 0, maxWidth: 760 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {TABS.map((t, i) =>
              i === 0 ? (
                <span key={t} className="btn" style={{ background: 'var(--primary)', color: 'var(--on-primary)', padding: '9px 16px', fontSize: 13.5 }}>
                  {t}
                </span>
              ) : (
                <span key={t} style={{ fontSize: 13.5, color: 'var(--ink-faint)', padding: '9px 16px', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
                  {t}
                </span>
              )
            )}
          </div>
          <div className="eyebrow">Business</div>
          <h2 style={{ fontSize: 24, marginBottom: 4 }}>Business profile</h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 24 }}>Your name, logo, colour and cover photo, as customers see them.</p>
          <div className="card card-pad">
            <div className="field">
              <label>Business name</label>
              <input defaultValue="Glow Salon" readOnly />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea rows={2} readOnly defaultValue="Lagos's go-to for natural hair care since 2019." />
            </div>
            <div className="field">
              <label>Accent color</label>
              <div className="swatch-row">
                <span className="swatch picked" style={{ background: 'var(--primary)' }} />
                <span className="swatch" style={{ background: 'var(--accent)' }} />
                <span className="swatch" style={{ background: '#7C2D12' }} />
                <span className="swatch" style={{ background: '#1E3A5F' }} />
              </div>
            </div>
            <a className="btn btn-primary" href="#" style={{ marginTop: 4 }}>
              Save changes
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

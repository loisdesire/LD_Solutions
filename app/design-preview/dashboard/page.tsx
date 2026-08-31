import AdminNav from '../_components/AdminNav';

export default function DesignPreviewDashboard() {
  return (
    <div>
      <AdminNav current="today" />
      <div className="dash-shell">
        <div className="wrap" style={{ padding: 0 }}>
          <div className="dash-head">
            <h2>Good morning, Glow Salon</h2>
            <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>
              Tuesday, 12 bookings today
            </span>
          </div>

          <div className="market-banner">
            <div className="mb-inner">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="mb-icon">G</div>
                <div>
                  <h3>Just tell Glow Salon&apos;s assistant what you need</h3>
                  <p>Add a service, change your hours, update your profile — no forms.</p>
                </div>
              </div>
              <a className="btn btn-primary" href="#">
                Start talking
              </a>
            </div>
          </div>

          <div className="stat-row">
            <div className="stat-card">
              <div className="label">Today</div>
              <div className="value">12</div>
            </div>
            <div className="stat-card">
              <div className="label">This week</div>
              <div className="value">₦184,000</div>
            </div>
            <div className="stat-card">
              <div className="label">Next up</div>
              <div className="value">2:30 PM</div>
            </div>
          </div>

          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 22 }}>
            <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-faint)', marginBottom: 14 }}>
              Today&apos;s bookings
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
              <span>Amaka · Gel Manicure</span>
              <span className="mono" style={{ color: 'var(--ink-faint)' }}>
                2:30 PM
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
              <span>Tolu · Deep Tissue Massage</span>
              <span className="mono" style={{ color: 'var(--ink-faint)' }}>
                4:00 PM
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 14 }}>
              <span>Chidinma · Haircut</span>
              <span className="mono" style={{ color: 'var(--ink-faint)' }}>
                5:15 PM
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

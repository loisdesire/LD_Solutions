import AdminNav from '../_components/AdminNav';

export default function DesignPreviewBilling() {
  return (
    <div>
      <AdminNav current="business" />
      <div className="dash-shell">
        <div className="wrap" style={{ padding: 0, maxWidth: 560 }}>
          <h2 style={{ fontSize: 24, marginBottom: 20 }}>Billing</h2>
          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13.5, color: 'var(--ink-faint)' }}>Current plan</span>
              <span className="chip-live">Trialing</span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>Core · ₦15,000/mo</div>
            <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 6 }}>11 days left in your free trial.</p>
            <a className="btn btn-primary" href="#" style={{ marginTop: 18 }}>
              Upgrade to Business Intelligence
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

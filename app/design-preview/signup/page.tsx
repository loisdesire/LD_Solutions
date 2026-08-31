import Link from 'next/link';

export default function DesignPreviewSignup() {
  return (
    <div>
      <nav className="site-nav">
        <Link href="/design-preview" className="logo">
          Vanova
        </Link>
        <div className="nav-links" />
        <span className="mono" style={{ fontSize: 13, color: 'var(--ink-faint)' }}>
          Already have an account?
        </span>
      </nav>
      <div className="auth-shell">
        <div className="auth-card">
          <h2 style={{ fontSize: 26, marginBottom: 26 }}>Create your account</h2>
          <div className="field">
            <label>Business name</label>
            <input placeholder="Your business name" readOnly />
          </div>
          <div className="field">
            <label>Email</label>
            <input placeholder="you@example.com" readOnly />
          </div>
          <div className="field">
            <label>Password</label>
            <input placeholder="At least 8 characters" readOnly />
          </div>
          <a className="btn btn-primary" href="#" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}>
            Create booking page →
          </a>
          <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, fontSize: 13.5, color: 'var(--ink-soft)' }}>
              <span style={{ color: 'var(--primary)' }}>✓</span>
              <span>
                <b style={{ color: 'var(--ink)' }}>No setup fees.</b> Start taking bookings today.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 13.5, color: 'var(--ink-soft)' }}>
              <span style={{ color: 'var(--primary)' }}>✓</span>
              <span>
                <b style={{ color: 'var(--ink)' }}>Your own link.</b> yoursite.com/your-name — share it anywhere.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 13.5, color: 'var(--ink-soft)' }}>
              <span style={{ color: 'var(--primary)' }}>✓</span>
              <span>
                <b style={{ color: 'var(--ink)' }}>Customers just book.</b> No apps, no accounts, no friction.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

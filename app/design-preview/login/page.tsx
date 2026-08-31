import Link from 'next/link';

export default function DesignPreviewLogin() {
  return (
    <div>
      <nav className="site-nav">
        <Link href="/design-preview" className="logo">
          Vanova
        </Link>
        <div className="nav-links" />
        <span className="mono" style={{ fontSize: 13, color: 'var(--ink-faint)' }}>
          Need an account?
        </span>
      </nav>
      <div className="auth-shell">
        <div className="auth-card">
          <h2 style={{ fontSize: 26, marginBottom: 26 }}>Log in</h2>
          <div className="field">
            <label>Email</label>
            <input placeholder="you@example.com" readOnly />
          </div>
          <div className="field">
            <label>Password</label>
            <input placeholder="Your password" readOnly />
          </div>
          <a className="btn btn-primary" href="#" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}>
            Log in →
          </a>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-faint)', marginTop: 18 }}>Forgot your password?</p>
        </div>
      </div>
    </div>
  );
}

import PublicNav from '../_components/PublicNav';
import CustomerBot from '../_components/CustomerBot';

export default function DesignPreviewConfirmed() {
  return (
    <div>
      <PublicNav />
      <div className="book-shell">
        <div className="auth-shell" style={{ minHeight: 'auto', padding: '70px 24px' }}>
          <div className="auth-card" style={{ textAlign: 'center', maxWidth: 460 }}>
            <div className="confirm-check">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h1 style={{ fontSize: 26, marginBottom: 8 }}>You&apos;re all set, Amaka!</h1>
            <p className="lede" style={{ margin: '0 auto 26px', textAlign: 'center' }}>
              A confirmation has been sent to your email.
            </p>
            <div className="card card-pad" style={{ textAlign: 'left', marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}>
                <span style={{ color: 'var(--ink-faint)' }}>Service</span>
                <span>Gel Manicure</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, borderTop: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--ink-faint)' }}>When</span>
                <span>Wed, 3 Sept · 2:30 PM</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, borderTop: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--ink-faint)' }}>Where</span>
                <span>Glow Salon</span>
              </div>
            </div>
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <a className="btn btn-outline" href="#">
                Add to calendar
              </a>
              <a className="btn btn-primary" href="#">
                Manage this booking
              </a>
            </div>
          </div>
        </div>
      </div>
      <CustomerBot />
    </div>
  );
}

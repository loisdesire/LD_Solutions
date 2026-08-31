import Link from 'next/link';
import PublicNav from '../_components/PublicNav';
import CustomerBot from '../_components/CustomerBot';

export default function DesignPreviewDetails() {
  return (
    <div>
      <PublicNav />
      <div className="book-shell">
        <div className="book-head" style={{ paddingBottom: 20 }}>
          <div className="progress-steps" style={{ justifyContent: 'center' }}>
            <span className="ps-dot done" />
            <span className="ps-line" />
            <span className="ps-dot done" />
            <span className="ps-line" />
            <span className="ps-dot" />
          </div>
          <Link href="/design-preview/schedule" style={{ fontSize: 13, color: 'var(--ink-faint)', textDecoration: 'none', display: 'inline-block', marginBottom: 10 }}>
            ← Change time
          </Link>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Your details</h1>
          <p className="lede" style={{ margin: '0 auto', textAlign: 'center' }}>
            Gel Manicure · Wed, 3 Sept · 2:30 PM · ₦8,000
          </p>
        </div>
        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          <div className="field">
            <label>Name</label>
            <input placeholder="Your full name" readOnly />
          </div>
          <div className="field">
            <label>Phone</label>
            <input placeholder="080..." readOnly />
          </div>
          <div className="field">
            <label>Email (optional)</label>
            <input placeholder="you@example.com" readOnly />
          </div>
          <Link className="btn btn-primary" href="/design-preview/confirmed" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
            Confirm booking
          </Link>
        </div>
      </div>
      <CustomerBot />
    </div>
  );
}

import Link from 'next/link';
import PublicNav from '../_components/PublicNav';
import CustomerBot from '../_components/CustomerBot';

export default function DesignPreviewSchedule() {
  return (
    <div>
      <PublicNav />
      <div className="book-shell">
        <div className="book-head" style={{ paddingBottom: 20 }}>
          <div className="progress-steps" style={{ justifyContent: 'center' }}>
            <span className="ps-dot done" />
            <span className="ps-line" />
            <span className="ps-dot" />
            <span className="ps-line" />
            <span className="ps-dot" />
          </div>
          <Link href="/design-preview/booking" style={{ fontSize: 13, color: 'var(--ink-faint)', textDecoration: 'none', display: 'inline-block', marginBottom: 10 }}>
            ← Change service
          </Link>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>When works for you?</h1>
          <p className="lede" style={{ margin: '0 auto', textAlign: 'center' }}>
            Gel Manicure · 45 min · ₦8,000
          </p>
        </div>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div className="cal-grid" style={{ marginBottom: 24 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div className="cal-h" key={d}>
                {d}
              </div>
            ))}
            <div className="cal-cell">
              <div className="d">1</div>
            </div>
            <div className="cal-cell">
              <div className="d">2</div>
            </div>
            <div className="cal-cell today">
              <div className="d">3</div>
            </div>
            <div className="cal-cell">
              <div className="d">4</div>
            </div>
            <div className="cal-cell">
              <div className="d">5</div>
            </div>
            <div className="cal-cell" style={{ opacity: 0.35 }}>
              <div className="d">6</div>
            </div>
            <div className="cal-cell" style={{ opacity: 0.35 }}>
              <div className="d">7</div>
            </div>
          </div>
          <div className="slot-pills">
            <span className="slot-pill">10:00 AM</span>
            <span className="slot-pill">11:30 AM</span>
            <span className="slot-pill picked">2:30 PM</span>
            <span className="slot-pill">4:00 PM</span>
            <span className="slot-pill">5:15 PM</span>
          </div>
          <div style={{ textAlign: 'right', marginTop: 22 }}>
            <Link className="btn btn-primary" href="/design-preview/details">
              Continue →
            </Link>
          </div>
        </div>
      </div>
      <CustomerBot />
    </div>
  );
}

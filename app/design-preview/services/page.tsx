import AdminNav from '../_components/AdminNav';

const SERVICES = [
  { name: 'Gel Manicure', meta: '45 min · Active', price: '₦8,000' },
  { name: 'Deep Tissue Massage', meta: '60 min · Active', price: '₦15,000' },
  { name: 'Signature Facial', meta: '50 min · Active', price: '₦12,500' },
];

export default function DesignPreviewServices() {
  return (
    <div>
      <AdminNav current="setup" />
      <div className="dash-shell">
        <div className="wrap" style={{ padding: 0 }}>
          <div className="dash-head">
            <div>
              <h2 style={{ fontSize: 24, marginBottom: 4 }}>Service catalog</h2>
              <p style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>What customers can book, and what it costs.</p>
            </div>
            <a className="btn btn-primary" href="#">
              + Add service
            </a>
          </div>
          <div className="service-list" style={{ borderTop: '1px solid var(--line)' }}>
            {SERVICES.map((s) => (
              <div className="service-row" key={s.name}>
                <div>
                  <h3>{s.name}</h3>
                  <div className="meta">{s.meta}</div>
                </div>
                <div className="price">{s.price}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

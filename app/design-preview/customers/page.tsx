import AdminNav from '../_components/AdminNav';

const CUSTOMERS = [
  { i: 'A', name: 'Amaka', contact: '080••••231', visits: 4, spent: '₦32,000', last: 'Today' },
  { i: 'T', name: 'Tolu', contact: '070••••882', visits: 2, spent: '₦30,000', last: 'Yesterday' },
  { i: 'C', name: 'Chidinma', contact: '081••••045', visits: 7, spent: '₦58,500', last: '3 days ago' },
];

export default function DesignPreviewCustomers() {
  return (
    <div>
      <AdminNav current="today" />
      <div className="dash-shell">
        <div className="wrap" style={{ padding: 0 }}>
          <div className="dash-head" style={{ display: 'block' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Today
            </div>
            <h2 style={{ fontSize: 24, marginBottom: 4 }}>Customers</h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>Everyone who&apos;s booked with Glow Salon, built from their actual bookings.</p>
          </div>
          <div className="card">
            <table className="table" style={{ padding: 16 }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 20 }}>Customer</th>
                  <th>Contact</th>
                  <th>Visits</th>
                  <th>Total spent</th>
                  <th>Last visit</th>
                </tr>
              </thead>
              <tbody>
                {CUSTOMERS.map((c) => (
                  <tr key={c.name}>
                    <td style={{ paddingLeft: 20 }}>
                      <span className="avatar-sm">{c.i}</span>
                      {c.name}
                    </td>
                    <td>{c.contact}</td>
                    <td>{c.visits}</td>
                    <td>{c.spent}</td>
                    <td>{c.last}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

import AdminNav from '../_components/AdminNav';

const CELLS: { d: number; ev?: string[]; today?: boolean; faint?: boolean }[] = [
  { d: 1, ev: ['9:00 Chidinma'] },
  { d: 2, ev: ['2:00 Tolu'] },
  { d: 3, ev: ['2:30 Amaka', '4:00 Tolu'], today: true },
  { d: 4 },
  { d: 5, ev: ['11:00 Chidinma'] },
  { d: 6, faint: true },
  { d: 7, faint: true },
];

export default function DesignPreviewCalendar() {
  return (
    <div>
      <AdminNav current="setup" />
      <div className="dash-shell">
        <div className="wrap" style={{ padding: 0 }}>
          <div className="dash-head">
            <h2 style={{ fontSize: 24 }}>Calendar</h2>
          </div>
          <div className="cal-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div className="cal-h" key={d}>
                {d}
              </div>
            ))}
            {CELLS.map((c) => (
              <div className={`cal-cell${c.today ? ' today' : ''}`} style={c.faint ? { opacity: 0.4 } : undefined} key={c.d}>
                <div className="d">{c.d}</div>
                {c.ev?.map((e) => (
                  <div className="ev" key={e}>
                    {e}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

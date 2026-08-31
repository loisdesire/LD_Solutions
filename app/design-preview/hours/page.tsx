import AdminNav from '../_components/AdminNav';

// Mirrors the real HoursManager: a day-selector rhythm bar (not a static
// 7-row list) with a detail panel for whichever day is selected -
// windows, a slot preview, copy-to-weekdays. Static here (this is a
// visual mockup, not the real interactive component) but structurally
// the same thing, re-skinned.
const DAYS = [
  { name: 'Mon', open: true },
  { name: 'Tue', open: true },
  { name: 'Wed', open: true, active: true },
  { name: 'Thu', open: true },
  { name: 'Fri', open: true },
  { name: 'Sat', open: false },
  { name: 'Sun', open: false },
];

const PREVIEW_SLOTS = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '+ 8 more'];

export default function DesignPreviewHours() {
  return (
    <div>
      <AdminNav current="setup" />
      <div className="dash-shell">
        <div className="wrap" style={{ padding: 0, maxWidth: 600 }}>
          <div className="dash-head">
            <div>
              <h2 style={{ fontSize: 24, marginBottom: 4 }}>Opening hours</h2>
              <p style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>When customers can actually book you.</p>
            </div>
          </div>

          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              Weekly rhythm
            </div>
            <h3 style={{ fontSize: 19, marginBottom: 18 }}>When can people reach you?</h3>

            <div className="day-rhythm">
              {DAYS.map((d) => (
                <div className={`day-chip${d.open ? ' open' : ''}${d.active ? ' active' : ''}${d.active && !d.open ? ' closed' : ''}`} key={d.name}>
                  <span className="dc-name">{d.name}</span>
                  <span className="dc-dot" />
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ fontSize: 20 }}>Wednesday</h3>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--accent-soft)', color: 'var(--primary)', borderRadius: 999, padding: '4px 10px' }}>
                    Open
                  </span>
                </div>
                <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>Copy Wednesday to Mon–Fri</span>
              </div>

              <div className="window-row">
                <input type="time" defaultValue="09:00" readOnly />
                <span className="to">to</span>
                <input type="time" defaultValue="18:00" readOnly />
              </div>
              <a href="#" style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                + Add another window
              </a>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--line)' }}>
                <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', marginBottom: 8 }}>
                  Example 30-min slots customers would see
                </p>
                <div className="slot-preview">
                  {PREVIEW_SLOTS.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </div>
              </div>

              <a className="btn btn-primary" href="#" style={{ marginTop: 20 }}>
                Save day
              </a>
            </div>
          </div>

          <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 14 }}>
            The dots show your weekly pattern. Select a day to adjust its opening windows.
          </p>
        </div>
      </div>
    </div>
  );
}

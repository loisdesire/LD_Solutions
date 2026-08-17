// A faithful mini-mockup of the real admin dashboard's Today strip and
// appointment list — same structure, same labels, same tokens as the
// actual /admin page, not an invented "dashboard-style" illustration.
// This is what a business owner actually sees, not a promise.
const SAMPLE_ROWS = [
  { time: '10:00', name: 'Amaka Johnson', service: 'Haircut', staff: 'John', status: 'Confirmed' },
  { time: '11:30', name: 'David Mensah', service: 'Beard trim', staff: 'Mike', status: 'Confirmed' },
  { time: '1:00', name: 'Priya Anand', service: 'Colour & gloss', staff: 'John', status: 'Confirmed' },
];

export default function DashboardPreview() {
  return (
    <div className="rounded-3xl bg-surface border-2 border-line shadow-[0_20px_50px_-20px_rgba(32,32,32,0.12)] overflow-hidden">
      <div className="rounded-2xl bg-warm-surface mx-5 mt-5 px-5 py-4 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint mb-1">Today</div>
          <div className="font-display text-[20px] font-bold" style={{ color: 'var(--accent)' }}>6</div>
        </div>
        <div>
          <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint mb-1">Next up</div>
          <div className="font-display text-[20px] font-bold text-ink">10:00</div>
        </div>
        <div>
          <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint mb-1">Today&rsquo;s revenue</div>
          <div className="font-display text-[20px] font-bold text-ink">₦48,000</div>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="hidden sm:grid grid-cols-[56px_1.4fr_1.2fr_0.8fr_100px] gap-3 pb-2 border-b border-line font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint">
          <div>Time</div>
          <div>Customer</div>
          <div>Service</div>
          <div>Staff</div>
          <div>Status</div>
        </div>
        {SAMPLE_ROWS.map((r, i) => (
          <div
            key={i}
            className={`grid grid-cols-[56px_1.4fr_1.2fr_0.8fr_100px] gap-3 items-center py-3 text-[13px] ${
              i !== SAMPLE_ROWS.length - 1 ? 'border-b border-line' : ''
            }`}
          >
            <div className="font-display font-semibold text-[14px]" style={{ color: 'var(--accent)' }}>{r.time}</div>
            <div className="font-medium text-ink truncate">{r.name}</div>
            <div className="text-ink-soft truncate">{r.service}</div>
            <div className="text-ink-soft truncate hidden sm:block">{r.staff}</div>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.05em] w-fit bg-success-bg text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {r.status}
            </span>
          </div>
        ))}
      </div>

      <div className="px-5 py-3 border-t border-line bg-paper font-mono text-[10.5px] text-ink-faint">
        This is the real dashboard layout — every row here is a booking that made itself.
      </div>
    </div>
  );
}

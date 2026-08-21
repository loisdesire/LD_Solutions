// A faithful mini-mockup of the real admin dashboard's Today strip and
// appointment list - same structure, same labels, same tokens as the
// actual /admin page, not an invented "dashboard-style" illustration.
// This is what a business owner actually sees, not a promise.
const SAMPLE_ROWS = [
  { time: '10:00', name: 'Amaka Johnson', service: 'Haircut', staff: 'John', status: 'Confirmed' },
  { time: '11:30', name: 'David Mensah', service: 'Beard trim', staff: 'Mike', status: 'Confirmed' },
  { time: '1:00', name: 'Priya Anand', service: 'Colour & gloss', staff: 'John', status: 'Confirmed' },
];

export default function DashboardPreview() {
  return (
    <div className="rounded-3xl bg-surface border-2 border-line shadow-[0_24px_60px_-20px_rgba(32,32,32,0.16)] overflow-hidden">
      <div className="flex bg-paper">
        <aside className="hidden sm:block w-[154px] shrink-0 bg-surface border-r border-line px-3.5 py-5">
        <div className="font-display text-[15px] font-semibold text-ink truncate">Your business</div>
        <div className="font-mono text-[8px] text-ink-faint mt-0.5 mb-6 truncate">Appointment business · /your-business</div>
        <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint px-2 mb-1.5">Manage</div>
        <nav className="flex flex-col gap-0.5 text-[11px]">
          <div className="rounded-lg px-2 py-2 font-semibold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Dashboard</div>
          <div className="px-2 py-2 text-ink-soft">Calendar</div>
          <div className="px-2 py-2 text-ink-soft">Customers</div>
          <div className="px-2 py-2 text-ink-soft">Services</div>
          <div className="px-2 py-2 text-ink-soft">Hours</div>
          <div className="px-2 py-2 text-ink-soft">Staff</div>
        </nav>
        </aside>

        <div className="min-w-0 flex-1 px-4 sm:px-5 py-5">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 rounded-full bg-surface border border-line px-3 py-2 min-w-0 flex-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-faint shrink-0">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
            </svg>
            <span className="text-[10px] text-ink-faint truncate">Search customers or bookings…</span>
          </div>
          <span className="rounded-lg bg-accent px-3 py-2 text-[10px] font-semibold text-white shrink-0">New appointment</span>
        </div>

        <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-faint mb-1">Manage</div>
        <h3 className="font-display text-[22px] text-ink mb-5">Dashboard</h3>

        <div className="rounded-xl bg-warm-surface px-4 py-4 mb-6 flex flex-wrap gap-x-5 gap-y-4">
          <div className="min-w-[54px] flex-1"><div className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faint mb-1">Today</div><div className="font-display text-[18px] font-bold" style={{ color: 'var(--accent)' }}>3</div><div className="text-[9px] text-ink-faint">appointments</div></div>
          <div className="min-w-[54px] flex-1"><div className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faint mb-1">Next up</div><div className="font-display text-[18px] font-bold text-ink">10:00</div><div className="text-[9px] text-ink-faint truncate">Amaka · Haircut</div></div>
          <div className="min-w-[70px] flex-1"><div className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faint mb-1">Today&rsquo;s revenue</div><div className="font-display text-[18px] font-bold text-ink">₦58k</div></div>
          <div className="min-w-[54px] flex-1"><div className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faint mb-1">This week</div><div className="font-display text-[18px] font-bold text-ink">8</div><div className="text-[9px] text-ink-faint">appointments</div></div>
        </div>

        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h4 className="font-display text-[16px] font-semibold text-ink">Upcoming bookings</h4>
          <span className="text-[9px] font-medium" style={{ color: 'var(--accent)' }}>View past →</span>
        </div>
        <div className="border-t-2 border-line">
          <div className="hidden md:grid grid-cols-[50px_1.3fr_1fr_0.8fr_66px] gap-2 px-1.5 py-2 border-b border-line font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faint">
            <div>Time</div><div>Customer</div><div>Service</div><div>Staff</div><div>Status</div>
          </div>
          {SAMPLE_ROWS.map((r, i) => (
            <div key={r.name} className={`grid grid-cols-[38px_1fr_auto] sm:grid-cols-[42px_1fr_1fr_auto] md:grid-cols-[50px_1.3fr_1fr_0.8fr_66px] gap-2 items-center px-1.5 py-2.5 text-[10px] ${i !== SAMPLE_ROWS.length - 1 ? 'border-b border-line' : ''}`}>
              <div className="font-display font-semibold" style={{ color: 'var(--accent)' }}>{r.time}</div>
              <div className="font-medium text-ink truncate">{r.name}</div>
              <div className="text-ink-soft truncate">{r.service}</div>
              <div className="text-ink-soft truncate hidden md:block">{r.staff}</div>
              <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-1 font-mono text-[7px] uppercase tracking-[0.04em] w-fit bg-accent-soft text-accent"><span className="h-1 w-1 rounded-full bg-current" />{r.status}</span>
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}

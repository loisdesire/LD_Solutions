import { formatMoney } from '@/lib/formatMoney';

// Rebuilt against the real AdminDashboardBody/AdminSidebar/BookingsList
// structure, not just the numbers - a prior pass fixed the stat order and
// heading shape but left several real divergences: a search bar + button
// top row that doesn't exist in the real page (search only ever shows once
// a business has 9+ bookings, and it's never paired with "New appointment"
// the way this mockup had it); a stat-card background (bg-warm-surface)
// the real dashboard's own comments say was explicitly tried and rejected
// as "reading like no background at all" before landing on a cream/paper
// color-mix; and a mobile stat layout (wrapping 2-column tiles) that's the
// exact pattern the real page moved away from because a stat's sub-line
// landing at a different height than its neighbour read as a rendering
// glitch. Sidebar now shows the real four job-named groups (Today/Set up/
// Automate/Business), abbreviated to fit 154px rather than all ten items.
// Trimmed from 3 rows to 2 - on mobile, the header row + greeting + the
// 4-stat card + "Upcoming bookings" + 3 full booking cards (each with
// time/name/service/duration/status) added up to a genuinely long scroll
// for what's meant to be a quick "here's what this looks like" teaser,
// not an exhaustive product screenshot.
const SAMPLE_ROWS = [
  { day: 'Today', time: '10:00', name: 'Amaka Johnson', service: 'Haircut', duration: '45 min', staff: 'John' },
  { day: 'Today', time: '11:30', name: 'David Mensah', service: 'Beard trim', duration: '20 min', staff: 'Mike' },
];

export default function DashboardPreview() {
  return (
    <div className="rounded-3xl bg-surface border-2 border-line shadow-[0_24px_60px_-20px_rgba(32,32,32,0.16)] overflow-hidden">
      <div className="flex bg-paper">
        <aside className="hidden sm:flex w-[154px] shrink-0 bg-surface border-r border-line px-3.5 py-5 flex-col">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center text-accent-contrast font-display text-[12px] font-bold shrink-0" style={{ background: 'var(--accent)' }}>
              Y
            </div>
            <div className="font-display text-[13px] font-semibold text-ink truncate">Your business</div>
          </div>

          <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint px-2 mb-1.5">Today</div>
          <nav className="flex flex-col gap-0.5 text-[11px] mb-4">
            <div className="rounded-lg px-2 py-1.5 font-semibold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Dashboard</div>
            <div className="px-2 py-1.5 text-ink-soft">Calendar</div>
            <div className="px-2 py-1.5 text-ink-soft">Customers</div>
          </nav>

          <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint px-2 mb-1.5">Set up</div>
          <nav className="flex flex-col gap-0.5 text-[11px] mb-4">
            <div className="px-2 py-1.5 text-ink-soft">Services</div>
          </nav>

          <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint px-2 mb-1.5">Automate</div>
          <nav className="flex flex-col gap-0.5 text-[11px] mb-4">
            <div className="px-2 py-1.5 text-ink-soft">Assistant</div>
          </nav>

          <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faint px-2 mb-1.5">Business</div>
          <nav className="flex flex-col gap-0.5 text-[11px]">
            <div className="px-2 py-1.5 text-ink-soft">Billing</div>
          </nav>
        </aside>

        <div className="min-w-0 flex-1 px-4 sm:px-5 py-5">
          {/* Same top strip shape as the real page: a short date label
              paired with the header actions on one line, the greeting and
              day summary flowing below as their own block - not a search
              bar and a button that never actually appear together. */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[10.5px] font-semibold" style={{ color: 'var(--accent)' }}>Monday, 1 September</span>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface px-1 py-1">
                <span className="h-6 w-6 rounded-full flex items-center justify-center text-ink-faint">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11.5 4.5" /><path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07L12.5 19.5" /></svg>
                </span>
                <span className="h-6 w-6 rounded-full flex items-center justify-center text-ink-faint">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" /></svg>
                </span>
              </div>
              <span className="rounded-full bg-accent h-7 w-7 flex items-center justify-center text-accent-contrast shrink-0">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              </span>
            </div>
          </div>

          <h3 className="font-display text-[22px] text-ink">Good morning</h3>
          <p className="text-ink-soft text-[11px] mt-1 mb-5">2 appointments today. Next is Amaka at 10:00.</p>

          {/* Real background (cream mixed into paper, not white-adjacent
              warm-surface), no border, shadow-soft - and the real stat
              order (Next up leads). */}
          <div
            className="rounded-xl px-4 py-4 mb-6 shadow-[0_1px_3px_rgba(32,32,32,0.06),0_1px_2px_rgba(32,32,32,0.08)]"
            style={{ background: 'color-mix(in srgb, var(--cream-surface) 22%, var(--paper))' }}
          >
            {/* Below sm: a divided single-column list, matching the real
                page's own mobile shape - not stats wrapping into a
                2-column grid where a sub-line makes neighbours misalign. */}
            <div className="flex flex-col divide-y divide-line-strong sm:flex-row sm:flex-wrap sm:divide-y-0 sm:gap-x-5 sm:gap-y-4">
              {[
                { label: 'Next up', value: '10:00', sub: 'Amaka · Haircut', color: 'var(--accent)' },
                { label: 'Today', value: '2', sub: 'appointments' },
                { label: "Today's revenue", value: formatMoney(58000), sub: 'from 2 appointments' },
                { label: 'This week', value: '8', sub: formatMoney(184000) },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center justify-between gap-3 py-2 sm:block sm:py-0 sm:min-w-[64px] sm:flex-1">
                  <div className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faint sm:mb-1">{stat.label}</div>
                  <div className="text-right sm:text-left">
                    <div className="font-display text-[16px] sm:text-[18px] font-bold" style={{ color: stat.color ?? 'var(--ink)' }}>{stat.value}</div>
                    <div className="text-[9px] text-ink-faint truncate">{stat.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h4 className="font-display text-[16px] font-semibold text-ink">Upcoming bookings</h4>
            <div className="hidden sm:inline-flex items-center gap-0.5 bg-warm-surface rounded-md p-0.5">
              {['Upcoming', 'Today', 'Past'].map((s) => (
                <span key={s} className={`px-2 py-1 rounded text-[9px] font-medium ${s === 'Upcoming' ? 'bg-surface text-ink' : 'text-ink-faint'}`}>{s}</span>
              ))}
            </div>
          </div>

          {/* Below sm: real bordered cards, one per booking, matching the
              actual page - not a squeezed multi-column grid row, which is
              exactly what read as cramped. sm and up: the real flat-row
              table shape. */}
          <div className="border-t-2 border-line sm:border-t-2">
            <div className="hidden md:grid grid-cols-[46px_1.2fr_1fr_0.8fr_60px] gap-2 px-1.5 py-2 border-b border-line font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faint">
              <div>Time</div><div>Customer</div><div>Service</div><div>Staff</div><div>Status</div>
            </div>
            {SAMPLE_ROWS.map((r, i) => (
              <div
                key={r.name}
                className={`rounded-xl border border-line bg-surface p-3 mb-2 shadow-[0_1px_2px_rgba(32,32,32,0.05)] sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none sm:mb-0 sm:px-1.5 sm:py-2.5 ${i !== SAMPLE_ROWS.length - 1 ? 'sm:border-b sm:border-line' : ''}`}
              >
                <div className="flex flex-col gap-1.5 sm:grid sm:grid-cols-[38px_1fr_auto] md:grid-cols-[46px_1.2fr_1fr_0.8fr_60px] sm:gap-2 sm:items-center">
                  <div className="flex items-center justify-between sm:block">
                    <span className="font-display font-semibold text-[10px]" style={{ color: 'var(--accent)' }}>{r.time}</span>
                    <span className="sm:hidden inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.04em] bg-accent-soft text-accent"><span className="h-1 w-1 rounded-full bg-current" />Confirmed</span>
                  </div>
                  <div className="font-medium text-ink text-[10px] truncate">{r.name}</div>
                  <div className="text-ink-soft text-[10px] truncate">
                    {r.service}
                    <span className="font-mono text-[8px] text-ink-faint ml-1.5 sm:block sm:ml-0">{r.duration}</span>
                  </div>
                  <div className="text-ink-soft text-[10px] truncate hidden md:block">{r.staff}</div>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full px-1.5 py-1 font-mono text-[7px] uppercase tracking-[0.04em] w-fit bg-accent-soft text-accent"><span className="h-1 w-1 rounded-full bg-current" />Confirmed</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

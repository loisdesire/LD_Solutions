const fs = require('fs');
const p = 'components/BookingForm.tsx';
let s = fs.readFileSync(p, 'utf8');
const BT = String.fromCharCode(96);

// Add-to-calendar. A data: URI download is blocked in some embedded
// contexts, so this builds a Google Calendar URL — a plain link that works
// everywhere and needs no file handling.
const helper = `// Google Calendar rather than an .ics download: a data:-URI download is
// blocked in a lot of in-app browsers (which is where a good share of these
// bookings happen), and a plain https link degrades to "opens a web page"
// in the worst case instead of silently doing nothing.
function googleCalendarUrl(opts: { title: string; startISO: string; minutes: number; details: string }): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(opts.startISO);
  const end = new Date(start.getTime() + opts.minutes * 60000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: ${BT}\${fmt(start)}/\${fmt(end)}${BT},
    details: opts.details,
  });
  return ${BT}https://calendar.google.com/calendar/render?\${params.toString()}${BT};
}

`;
s = s.replace('function StepIndicator(', helper + 'function StepIndicator(');

// Confirmation actions: calendar + back to the business, alongside manage.
const oldTail = `        <div className="text-center mt-5">
          <Link
            href={${BT}/\${slug}/manage/\${bookingId}${BT}}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors hover:opacity-80"
            style={{ color: 'var(--accent)' }}
          >
            Manage this booking
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>`;
if (!s.includes(oldTail)) { console.error('confirmation tail missing'); process.exit(1); }

const newTail = `        {/* Was a single ~20px-tall text link. A customer who has just booked
            wants to save it or go back to the business — neither was offered. */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
          {selectedService && selectedSlot && (
            <a
              href={googleCalendarUrl({
                title: ${BT}\${selectedService.name} — \${businessName}${BT},
                startISO: selectedSlot,
                minutes: selectedService.duration_minutes,
                details: ${BT}Booking code \${bookingId.slice(0, 8).toUpperCase()}${BT},
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-5 py-3 min-h-[44px] rounded-full border-2 border-line-strong text-[13.5px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
              </svg>
              Add to calendar
            </a>
          )}
          <Link
            href={${BT}/\${slug}/manage/\${bookingId}${BT}}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-3 min-h-[44px] rounded-full text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            Manage this booking
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="text-center mt-4">
          <Link href={${BT}/\${slug}${BT}} className="text-[13px] text-ink-faint hover:text-ink transition-colors">
            Back to {businessName}
          </Link>
        </div>`;

s = s.replace(oldTail, newTail);
fs.writeFileSync(p, s);
console.log('confirmation actions added');

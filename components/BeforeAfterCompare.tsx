// The actual argument for this product, rendered as the thing it's
// arguing about - two real-looking message threads, same request, real
// timestamps. The gap between "next day, 8:02 AM" and "9:15 AM, same
// morning" is the entire pitch; nothing needs to be said about it.
type Msg = { from: 'them' | 'you'; time: string; text: string };

const MANUAL: Msg[] = [
  { from: 'them', time: '9:14 AM', text: 'Hi! Are you free Tuesday?' },
  { from: 'you', time: '12:40 PM', text: 'Let me check and get back to you' },
  { from: 'you', time: 'Next day, 8:02 AM', text: 'Sorry for the wait. Yes, 2pm works' },
  { from: 'them', time: 'Next day, 8:15 AM', text: 'Ok, see you then' },
];

const AUTOMATIC: Msg[] = [
  { from: 'them', time: '9:14 AM', text: 'Hi! Are you free Tuesday?' },
  { from: 'you', time: '9:14 AM', text: 'Yes, 11am, 2pm or 3:30pm. Which works?' },
  { from: 'them', time: '9:15 AM', text: '2pm' },
  { from: 'you', time: '9:15 AM', text: 'Booked for Tuesday at 2pm ✓' },
];

function Thread({ messages, accentVar, textVar = '#fff' }: { messages: Msg[]; accentVar: string; textVar?: string }) {
  return (
    <div className="space-y-3">
      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.from === 'you' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] ${m.from === 'you' ? 'text-right' : 'text-left'}`}>
            <div
              className={`inline-block rounded-2xl px-3.5 py-2 text-[13px] ${
                m.from === 'you' ? 'rounded-br-md' : 'bg-paper text-ink rounded-bl-md'
              }`}
              style={m.from === 'you' ? { background: accentVar, color: textVar } : undefined}
            >
              {m.text}
            </div>
            <div className="font-mono text-[9.5px] text-ink-faint mt-1">{m.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BeforeAfterCompare() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="rounded-2xl border-2 border-line bg-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            Answering it yourself
          </p>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.06em] px-2 py-1 rounded-full bg-ink-wash text-ink-faint">
            ~23 hours
          </span>
        </div>
        <Thread messages={MANUAL} accentVar="var(--ink-soft)" />
      </div>
      <div className="rounded-2xl border-2 p-5" style={{ borderColor: 'color-mix(in srgb, var(--accent) 30%, var(--line))', background: 'var(--accent-soft)' }}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--accent)' }}>
            With an AI receptionist
          </p>
          <span
            className="font-mono text-[9.5px] uppercase tracking-[0.06em] px-2 py-1 rounded-full"
            style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
          >
            ~1 minute
          </span>
        </div>
        <Thread messages={AUTOMATIC} accentVar="var(--accent)" textVar="var(--accent-contrast)" />
      </div>
    </div>
  );
}

// The actual argument for this product, rendered as the thing it's
// arguing about — two real-looking message threads, same request, real
// timestamps. The gap between "next day, 8:02 AM" and "9:15 AM, same
// morning" is the entire pitch; nothing needs to be said about it.
type Msg = { from: 'them' | 'you'; time: string; text: string };

const MANUAL: Msg[] = [
  { from: 'them', time: '9:14 AM', text: 'Hi! Are you free Tuesday?' },
  { from: 'you', time: '12:40 PM', text: 'Let me check and get back to you' },
  { from: 'you', time: 'Next day, 8:02 AM', text: 'Sorry for the wait — yes, 2pm works' },
  { from: 'them', time: 'Next day, 8:15 AM', text: 'Ok, see you then' },
];

const AUTOMATIC: Msg[] = [
  { from: 'them', time: '9:14 AM', text: 'Hi! Are you free Tuesday?' },
  { from: 'you', time: '9:14 AM', text: 'Yes — 11am, 2pm or 3:30pm. Which works?' },
  { from: 'them', time: '9:15 AM', text: '2pm' },
  { from: 'you', time: '9:15 AM', text: 'Booked for Tuesday at 2pm ✓' },
];

function Thread({ messages, accentVar }: { messages: Msg[]; accentVar: string }) {
  return (
    <div className="space-y-3">
      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.from === 'you' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] ${m.from === 'you' ? 'text-right' : 'text-left'}`}>
            <div
              className={`inline-block rounded-2xl px-3.5 py-2 text-[13px] ${
                m.from === 'you' ? 'text-white rounded-br-md' : 'bg-paper text-ink rounded-bl-md'
              }`}
              style={m.from === 'you' ? { background: accentVar } : undefined}
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
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint mb-4">
          Answering it yourself
        </p>
        <Thread messages={MANUAL} accentVar="var(--ink-soft)" />
      </div>
      <div className="rounded-2xl border-2 p-5" style={{ borderColor: 'color-mix(in srgb, var(--accent) 30%, var(--line))', background: 'var(--accent-soft)' }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] mb-4" style={{ color: 'var(--accent)' }}>
          With an AI receptionist
        </p>
        <Thread messages={AUTOMATIC} accentVar="var(--accent)" />
      </div>
    </div>
  );
}

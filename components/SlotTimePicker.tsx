'use client';

import { useState, useMemo } from 'react';

// A collapsed "tap to pick a time" trigger that expands into a scroll-strip
// hour/minute picker - not a permanently-inline block. The two-column
// picker itself (group the already-availability-checked slots by hour, only
// ever show hours/minutes that are actually open - buffer time and existing
// bookings already excluded before any of this renders) is the same idea
// BookingForm had before, just no longer pinned open by default. It only
// takes up screen space while someone is actively choosing, closes itself
// the moment a minute is picked, and collapses back to a single line
// showing the result - the actual "click the clock, a strip pops up"
// interaction, not a fixed block sitting on the page whether or not anyone
// is using it. Shared between the public BookingForm and the admin
// NewAppointmentModal so both surfaces get one real fix instead of one
// getting it and the other keeping the old flat slot dump.
function groupSlotsByHour(slots: string[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const s of slots) {
    const h = new Date(s).getHours();
    if (!map.has(h)) map.set(h, []);
    map.get(h)!.push(s);
  }
  return map;
}

function formatHourLabel(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${period}`;
}

function formatMinuteLabel(iso: string): string {
  return `:${String(new Date(iso).getMinutes()).padStart(2, '0')}`;
}

function formatFullTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function SlotTimePicker({
  slots,
  selectedSlot,
  onSelect,
}: {
  slots: string[];
  selectedSlot: string;
  onSelect: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Which hour's minutes the strip is currently showing - null until
  // resolved (first available hour, or the hour of an already-selected
  // slot when reopening). Tapping an hour alone already selects its first
  // open minute, so one tap is a complete, valid choice; the minute column
  // just lets you refine it before the picker closes.
  const [highlightedHour, setHighlightedHour] = useState<number | null>(null);

  const hourGroups = useMemo(() => groupSlotsByHour(slots), [slots]);
  const availableHours = useMemo(() => [...hourGroups.keys()].sort((a, b) => a - b), [hourGroups]);
  const activeHour =
    highlightedHour != null && hourGroups.has(highlightedHour)
      ? highlightedHour
      : selectedSlot && hourGroups.has(new Date(selectedSlot).getHours())
        ? new Date(selectedSlot).getHours()
        : (availableHours[0] ?? null);
  const minutesForActiveHour = activeHour != null ? (hourGroups.get(activeHour) ?? []) : [];

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        style={
          selectedSlot
            ? { background: 'var(--accent-soft)', borderColor: 'var(--accent)', color: 'var(--accent)' }
            : undefined
        }
        className={`w-full flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-[14px] font-semibold transition-colors ${
          selectedSlot ? '' : 'border-line-strong bg-surface text-ink hover:border-[var(--accent)]'
        }`}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" strokeLinecap="round" />
        </svg>
        <span className="flex-1 text-left tabular-nums">
          {selectedSlot ? `${formatFullTime(selectedSlot)} selected` : 'Select a time'}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 flex justify-center gap-3 animate-rise">
          <div className="w-[108px]">
            <div className="text-center font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint mb-2">Hour</div>
            <div className="h-[180px] overflow-y-auto rounded-xl border border-line-strong bg-surface p-1.5 snap-y snap-mandatory scroll-smooth">
              <div className="space-y-1">
                {availableHours.map((h) => {
                  const isActive = h === activeHour;
                  return (
                    <button
                      key={h}
                      type="button"
                      ref={(el) => {
                        if (isActive) el?.scrollIntoView({ block: 'center' });
                      }}
                      onClick={() => {
                        setHighlightedHour(h);
                        const firstInHour = hourGroups.get(h)?.[0];
                        if (firstInHour) onSelect(firstInHour);
                      }}
                      className="w-full py-2.5 rounded-lg text-[14px] font-semibold tabular-nums snap-center transition-colors"
                      style={isActive ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : { color: 'var(--ink)' }}
                    >
                      {formatHourLabel(h)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="w-[108px]">
            <div className="text-center font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint mb-2">Minute</div>
            <div className="h-[180px] overflow-y-auto rounded-xl border border-line-strong bg-surface p-1.5 snap-y snap-mandatory scroll-smooth">
              <div className="space-y-1">
                {minutesForActiveHour.map((t) => {
                  const isSel = t === selectedSlot;
                  return (
                    <button
                      key={t}
                      type="button"
                      ref={(el) => {
                        if (isSel) el?.scrollIntoView({ block: 'center' });
                      }}
                      onClick={() => {
                        // Closes the picker - this is the finalize step,
                        // the one action that turns "browsing times" into
                        // "chosen", so it's the moment to collapse back
                        // down and give the space back.
                        onSelect(t);
                        setOpen(false);
                      }}
                      className={`w-full py-2.5 rounded-lg text-[14px] font-semibold tabular-nums snap-center transition-all ${
                        isSel ? 'animate-punch' : ''
                      }`}
                      style={isSel ? { background: 'var(--accent)', color: 'var(--accent-contrast)' } : { color: 'var(--ink)' }}
                    >
                      {formatMinuteLabel(t)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

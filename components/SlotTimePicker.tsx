'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// A real spinner popup - tap the trigger, a small card floats up with two
// continuous scroll wheels (hour, minute), and whichever value is centered
// when you stop scrolling (or close the popup) is the choice. No rows to
// tap, no permanently-expanded block sitting on the page - this replaced
// an earlier version that expanded an always-tappable two-column list
// inline, which still read as "a pile of buttons," just a collapsed pile.
// The wheels themselves are still built from the already-availability-
// checked slots (from /api/availability) grouped by hour, so buffer time
// and existing bookings are excluded before anything here ever renders -
// only real open hours/minutes are on the dial, never a full 12/60-item
// clock with most of it disabled.
//
// Shared between the public BookingForm, the admin NewAppointmentModal
// quick-add, and ManageBooking's reschedule flow.
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

const ROW_H = 44; // px - also the min touch-target height
const WHEEL_H = ROW_H * 3; // one centered row plus one full neighbour above/below

// A controlled wheel: `index` is the source of truth from the parent.
// Scrolling only ever moves ITSELF (via onSettle, debounced after the
// user stops) back up to the parent - it never fights the parent for
// control, and it only re-scrolls itself programmatically when `index`
// changed for a reason other than its own last settle (the minute wheel
// resetting because the hour wheel landed on a new hour, or the initial
// position on open).
function Wheel({
  items,
  index,
  onSettle,
  ariaLabel,
}: {
  items: { key: string; label: string }[];
  index: number;
  onSettle: (i: number) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(index);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [liveIndex, setLiveIndex] = useState(index);

  useEffect(() => {
    ref.current?.scrollTo({ top: index * ROW_H, behavior: 'auto' });
    // Only on mount - later external resets are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (index === lastEmitted.current) return; // this is our own settle echoing back - don't re-scroll ourselves
    lastEmitted.current = index;
    setLiveIndex(index);
    ref.current?.scrollTo({ top: index * ROW_H, behavior: 'auto' });
  }, [index]);

  function handleScroll() {
    const el = ref.current;
    if (!el) return;
    const nearest = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ROW_H)));
    setLiveIndex(nearest);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      lastEmitted.current = nearest;
      onSettle(nearest);
    }, 120);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      ref.current?.scrollBy({ top: ROW_H, behavior: 'smooth' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      ref.current?.scrollBy({ top: -ROW_H, behavior: 'smooth' });
    }
  }

  return (
    <div className="relative w-[92px]">
      {/* The center "slot" the numbers scroll through - decorative only,
          the real selection is just whatever row is scrolled to center. */}
      <div
        className="pointer-events-none absolute left-0 right-0 rounded-xl border-y-2"
        style={{ top: ROW_H, height: ROW_H, borderColor: 'var(--accent-soft)' }}
        aria-hidden="true"
      />
      <div
        ref={ref}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="listbox"
        aria-label={ariaLabel}
        className="h-[132px] overflow-y-auto snap-y snap-mandatory scroll-smooth outline-none"
        style={{
          paddingTop: ROW_H,
          paddingBottom: ROW_H,
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)',
          maskImage: 'linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)',
        }}
      >
        {items.map((it, i) => {
          const dist = Math.abs(i - liveIndex);
          return (
            <div
              key={it.key}
              role="option"
              aria-selected={i === liveIndex}
              className="flex items-center justify-center snap-center font-display tabular-nums transition-all duration-150"
              style={{
                height: ROW_H,
                fontSize: dist === 0 ? '24px' : '17px',
                fontWeight: dist === 0 ? 700 : 500,
                opacity: dist === 0 ? 1 : dist === 1 ? 0.4 : 0.16,
                color: dist === 0 ? 'var(--accent)' : 'var(--ink-faint)',
              }}
            >
              {it.label}
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const hourGroups = useMemo(() => groupSlotsByHour(slots), [slots]);
  const availableHours = useMemo(() => [...hourGroups.keys()].sort((a, b) => a - b), [hourGroups]);

  const [hourIdx, setHourIdx] = useState(() => {
    if (selectedSlot) {
      const idx = availableHours.indexOf(new Date(selectedSlot).getHours());
      if (idx >= 0) return idx;
    }
    return 0;
  });
  const activeHour = availableHours[hourIdx] ?? null;
  const minutesForHour = activeHour != null ? (hourGroups.get(activeHour) ?? []) : [];

  const [minuteIdx, setMinuteIdx] = useState(() => {
    if (selectedSlot && activeHour === new Date(selectedSlot).getHours()) {
      const idx = minutesForHour.indexOf(selectedSlot);
      if (idx >= 0) return idx;
    }
    return 0;
  });

  // A different hour means a different minute list - "3rd minute in the
  // old hour" carries no meaning for a new one, so this resets to the
  // first open minute of whichever hour is now centered.
  const hourRef = useRef(activeHour);
  useEffect(() => {
    if (hourRef.current === activeHour) return;
    hourRef.current = activeHour;
    setMinuteIdx(0);
  }, [activeHour]);

  const currentSlot = minutesForHour[minuteIdx] ?? minutesForHour[0] ?? '';

  function close() {
    if (currentSlot) onSelect(currentSlot);
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Escape + a self-contained Tab trap, deliberately not the shared
  // useDialog hook - this popup can itself sit inside another dialog
  // (NewAppointmentModal), and useDialog's own body-scroll-lock and
  // back-button binding both assume there's exactly one dialog open at a
  // time. Two independent copies racing over the same
  // document.body.style.overflow is the exact bug already fixed once in
  // NewAppointmentModal's history; this avoids repeating it by not
  // touching scroll lock or history state at all. Escape is bound on this
  // popup's own element (not document), so it's caught during the bubble
  // phase before it ever reaches an ancestor dialog's own document-level
  // Escape listener - closing just this popup, never the modal behind it.
  useEffect(() => {
    if (!open) return;
    const node = popupRef.current;
    node?.querySelector<HTMLElement>('button, [tabindex]')?.focus();
  }, [open]);

  function handlePopupKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = Array.from(
      popupRef.current?.querySelectorAll<HTMLElement>('button, [tabindex="0"]') ?? []
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
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
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Select a time">
          <div
            className="absolute inset-0 backdrop-blur-sm animate-fade"
            style={{ background: 'color-mix(in srgb, var(--ink) 45%, transparent)' }}
            onClick={close}
          />
          <div
            ref={popupRef}
            onKeyDown={handlePopupKeyDown}
            className="relative w-full max-w-[300px] rounded-3xl bg-surface border-2 border-line-strong shadow-[0_30px_70px_-25px_rgba(36,28,24,0.45)] animate-rise p-5"
          >
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-4">
              Scroll to a time
            </p>
            <div className="flex items-center justify-center gap-1.5">
              <Wheel
                items={availableHours.map((h) => ({ key: String(h), label: formatHourLabel(h) }))}
                index={hourIdx}
                onSettle={setHourIdx}
                ariaLabel="Hour"
              />
              <span className="font-display text-[20px] font-bold text-ink-faint pb-0.5" aria-hidden="true">:</span>
              <Wheel
                items={minutesForHour.map((t) => ({ key: t, label: formatMinuteLabel(t) }))}
                index={minuteIdx}
                onSettle={setMinuteIdx}
                ariaLabel="Minute"
              />
            </div>
            <button
              type="button"
              onClick={close}
              className="w-full mt-5 py-3 text-[14px] font-semibold text-accent-contrast rounded-full transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'var(--accent)' }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

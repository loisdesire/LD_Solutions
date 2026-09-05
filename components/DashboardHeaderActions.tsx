'use client';

import { useState } from 'react';
import NewAppointmentModal from './NewAppointmentModal';

type ExportRow = {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  start_time: string;
  status: string;
  service_name: string | null;
};

type Service = { id: string; name: string; duration_minutes: number; price: number | null };

export default function DashboardHeaderActions({
  slug,
  businessId,
  services,
  maxAdvanceDays,
}: {
  slug: string;
  businessId: string;
  services: Service[];
  maxAdvanceDays: number;
}) {
  const [copied, setCopied] = useState(false);
  const [showNewAppointment, setShowNewAppointment] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Was built here from whatever the dashboard had already loaded, which
  // forced the page to fetch every booking a business had ever taken just
  // in case someone pressed this. The route builds it on demand instead.
  function handleExport() {
    window.location.href = `/api/bookings/export?slug=${encodeURIComponent(slug)}`;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Copy link + Export used to just be two bare circles floating next
          to New appointment's solid one, with only a gap between them and
          nothing tying them together - looked like three unrelated buttons
          that happened to end up in a row, especially once they were
          icon-only on mobile. A shared pill groups them as one secondary
          toolbar, so New appointment (still its own solid-accent circle,
          unchanged) reads as the one deliberately separate primary action
          instead of a third peer in an undifferentiated row. */}
      <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-1">
        {/* Copy link put the URL on the clipboard, but there was no way to
            actually SEE the live page from the admin itself - an owner
            wanting to check what a customer sees had to know the URL and
            open it manually. A real, direct view, not another copy step. */}
        <a
          href={`/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View live booking page"
          title="View live booking page"
          className="h-8 sm:h-auto flex items-center justify-center sm:justify-start gap-2 rounded-full px-0 sm:px-3.5 sm:py-2 w-8 sm:w-auto text-ink-faint hover:bg-paper hover:text-ink transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="shrink-0" aria-hidden="true">
            <path d="M14 3h7v7" /><path d="M10 14L21 3" />
            <path d="M19 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6" />
          </svg>
          <span className="hidden sm:inline text-[13px] font-medium whitespace-nowrap">View live page</span>
        </a>
        <button
          onClick={handleCopy}
          aria-label="Copy booking link"
          title={copied ? 'Copied' : 'Copy booking link'}
          className="h-8 sm:h-auto flex items-center justify-center sm:justify-start gap-2 rounded-full px-0 sm:px-3.5 sm:py-2 w-8 sm:w-auto text-ink-faint hover:bg-paper hover:text-ink transition-colors"
        >
          {copied ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="shrink-0">
              <path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11.5 4.5" />
              <path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07L12.5 19.5" />
            </svg>
          )}
          <span className="hidden sm:inline text-[13px] font-medium whitespace-nowrap">
            {copied ? 'Copied' : 'Copy link'}
          </span>
        </button>
        <button
          onClick={handleExport}
          aria-label="Export CSV"
          title="Export CSV"
          className="h-8 sm:h-auto flex items-center justify-center sm:justify-start gap-2 rounded-full px-0 sm:px-3.5 sm:py-2 w-8 sm:w-auto text-ink-faint hover:bg-paper hover:text-ink transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="shrink-0" aria-hidden="true">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />
          </svg>
          <span className="hidden sm:inline text-[13px] font-medium whitespace-nowrap">Export CSV</span>
        </button>
      </div>
      {/* Was full text + icon at every width, the only one of these three
          that never collapsed - Copy link and Export CSV both already went
          icon-only below sm, so this was the one thing forcing the whole
          row wider than it needed to be on a phone. Same collapse now,
          matching its siblings, still the one solid-accent circle among
          two quiet outline ones so it stays the obvious primary action. */}
      <button
        onClick={() => setShowNewAppointment(true)}
        aria-label="New appointment"
        title="New appointment"
        className="h-10 sm:h-auto flex items-center justify-center sm:justify-start gap-2 rounded-full px-0 sm:px-5 sm:py-2.5 w-10 sm:w-auto text-[13.5px] font-semibold text-accent-contrast shadow-sm transition-all hover:opacity-90 active:scale-95 shrink-0"
        style={{ background: 'var(--accent)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0"><path d="M12 5v14M5 12h14" /></svg>
        <span className="hidden sm:inline whitespace-nowrap">New appointment</span>
      </button>

      {showNewAppointment && (
        <NewAppointmentModal
          businessId={businessId}
          services={services}
          maxAdvanceDays={maxAdvanceDays}
          onClose={() => setShowNewAppointment(false)}
        />
      )}
    </div>
  );
}

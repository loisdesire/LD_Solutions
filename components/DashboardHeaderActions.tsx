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
      <button
        onClick={handleCopy}
        aria-label="Copy booking link"
        title={copied ? 'Copied' : 'Copy booking link'}
        className="h-10 w-10 flex items-center justify-center rounded-full text-ink-faint hover:bg-paper hover:text-ink transition-colors"
      >
        {copied ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11.5 4.5" />
            <path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07L12.5 19.5" />
          </svg>
        )}
      </button>
      <button
          onClick={handleExport}
          aria-label="Export CSV"
          title="Export CSV"
          className="h-10 w-10 flex items-center justify-center rounded-full text-ink-faint hover:bg-paper hover:text-ink transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />
          </svg>
        </button>
      <button
        onClick={() => setShowNewAppointment(true)}
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
        style={{ background: 'var(--accent)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
        New appointment
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

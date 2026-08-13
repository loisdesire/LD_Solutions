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
  rows = [],
  businessId,
  services,
  maxAdvanceDays,
}: {
  slug: string;
  rows?: ExportRow[];
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

  function handleExport() {
    const header = ['Customer', 'Email', 'Phone', 'When', 'Service', 'Status'];
    const lines = rows.map((r) =>
      [
        r.customer_name,
        r.customer_email ?? '',
        r.customer_phone ?? '',
        new Date(r.start_time).toLocaleString(),
        r.service_name ?? '',
        r.status,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-bookings.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      {rows.length > 0 && (
        <button
          onClick={handleExport}
          aria-label="Export CSV"
          title="Export CSV"
          className="h-10 w-10 flex items-center justify-center rounded-full text-ink-faint hover:bg-paper hover:text-ink transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />
          </svg>
        </button>
      )}
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

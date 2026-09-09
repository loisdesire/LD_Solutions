'use client';

import { useState } from 'react';
import Icon from './Icon';
import NewAppointmentModal from './NewAppointmentModal';

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

  function handleExport() {
    window.location.href = `/api/bookings/export?slug=${encodeURIComponent(slug)}`;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Bordered rounded-md icon buttons, not a pill of circles - the
          Stitch dashboard's actual header-action treatment (each button
          its own bordered square, not grouped inside a shared pill). */}
      <div className="hidden items-center gap-1.5 sm:flex">
        <span className="group relative">
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View live booking page"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-ink-faint hover:bg-warm-surface hover:text-ink transition-all"
          >
            <Icon name="open_in_new" size={18} />
          </a>
          <span className="pointer-events-none absolute right-0 top-full z-30 mt-2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-paper opacity-0 shadow-lift transition-opacity group-hover:opacity-100">View live page</span>
        </span>
        <span className="group relative">
          <button
            onClick={handleCopy}
            aria-label="Copy booking link"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-ink-faint hover:bg-warm-surface hover:text-ink transition-all"
          >
            <Icon name={copied ? 'check' : 'link'} size={18} />
          </button>
          <span className="pointer-events-none absolute right-0 top-full z-30 mt-2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-paper opacity-0 shadow-lift transition-opacity group-hover:opacity-100">{copied ? 'Copied' : 'Copy link'}</span>
        </span>
        <span className="group relative">
          <button
            onClick={handleExport}
            aria-label="Export CSV"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-ink-faint hover:bg-warm-surface hover:text-ink transition-all"
          >
            <Icon name="file_download" size={18} />
          </button>
          <span className="pointer-events-none absolute right-0 top-full z-30 mt-2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-paper opacity-0 shadow-lift transition-opacity group-hover:opacity-100">Export CSV</span>
        </span>
      </div>

      <button
        onClick={() => setShowNewAppointment(true)}
        aria-label="New appointment"
        title="New appointment"
        className="h-10 sm:h-9 flex items-center justify-center sm:justify-start gap-1.5 rounded-md px-0 sm:px-3.5 w-10 sm:w-auto text-[13px] font-semibold text-accent-contrast shadow-sm transition-all hover:opacity-90 active:scale-95 shrink-0"
        style={{ background: 'var(--accent)' }}
      >
        <Icon name="add" size={16} />
        <span className="hidden sm:inline whitespace-nowrap">New appointment</span>
      </button>

      <details className="relative sm:hidden">
        <summary aria-label="More dashboard actions" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border border-line bg-surface text-ink-soft hover:text-ink">
          <Icon name="more_vert" size={18} />
        </summary>
        <div className="absolute right-0 top-12 z-30 w-48 rounded-xl border border-line bg-surface p-1.5 shadow-card">
          <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-ink-soft hover:bg-paper hover:text-ink"><Icon name="open_in_new" size={16} /><span>View live page</span></a>
          <button onClick={handleCopy} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-ink-soft hover:bg-paper hover:text-ink"><Icon name={copied ? 'check' : 'link'} size={16} /><span>{copied ? 'Copied' : 'Copy link'}</span></button>
          <button onClick={handleExport} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-ink-soft hover:bg-paper hover:text-ink"><Icon name="file_download" size={16} /><span>Export CSV</span></button>
        </div>
      </details>

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

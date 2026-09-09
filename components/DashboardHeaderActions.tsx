'use client';

import { useState } from 'react';
import NewAppointmentModal from './NewAppointmentModal';

type Service = { id: string; name: string; duration_minutes: number; price: number | null };

function ViewIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M14 3h7v7" /><path d="M10 14L21 3" />
      <path d="M19 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6" />
    </svg>
  );
}

function CopyIcon({ copied }: { copied: boolean }) {
  return copied ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11.5 4.5" />
      <path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07L12.5 19.5" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />
    </svg>
  );
}

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
      <div className="hidden items-center gap-0.5 rounded-full border border-line bg-surface p-1 sm:flex">
        <span className="group relative">
          <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" aria-label="View live booking page" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:bg-paper hover:text-ink transition-colors">
            <ViewIcon />
          </a>
          <span className="pointer-events-none absolute right-0 top-full z-30 mt-2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-paper opacity-0 shadow-lift transition-opacity group-hover:opacity-100">View live page</span>
        </span>
        <span className="group relative">
          <button onClick={handleCopy} aria-label="Copy booking link" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:bg-paper hover:text-ink transition-colors">
            <CopyIcon copied={copied} />
          </button>
          <span className="pointer-events-none absolute right-0 top-full z-30 mt-2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-paper opacity-0 shadow-lift transition-opacity group-hover:opacity-100">{copied ? 'Copied' : 'Copy link'}</span>
        </span>
        <span className="group relative">
          <button onClick={handleExport} aria-label="Export CSV" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:bg-paper hover:text-ink transition-colors">
            <ExportIcon />
          </button>
          <span className="pointer-events-none absolute right-0 top-full z-30 mt-2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-paper opacity-0 shadow-lift transition-opacity group-hover:opacity-100">Export CSV</span>
        </span>
      </div>

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

      <details className="relative sm:hidden">
        <summary aria-label="More dashboard actions" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-line bg-surface text-ink-soft hover:text-ink">
          <span className="text-xl leading-none" aria-hidden="true">&#8943;</span>
        </summary>
        <div className="absolute right-0 top-12 z-30 w-48 rounded-xl border border-line bg-surface p-1.5 shadow-card">
          <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-ink-soft hover:bg-paper hover:text-ink"><ViewIcon /><span>View live page</span></a>
          <button onClick={handleCopy} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-ink-soft hover:bg-paper hover:text-ink"><CopyIcon copied={copied} /><span>{copied ? 'Copied' : 'Copy link'}</span></button>
          <button onClick={handleExport} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-ink-soft hover:bg-paper hover:text-ink"><ExportIcon /><span>Export CSV</span></button>
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

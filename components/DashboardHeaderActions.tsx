'use client';

import { useState } from 'react';

type ExportRow = {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  start_time: string;
  status: string;
  service_name: string | null;
};

export default function DashboardHeaderActions({
  slug,
  rows = [],
}: {
  slug: string;
  rows?: ExportRow[];
}) {
  const [copied, setCopied] = useState(false);

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
        className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3.5 py-2 text-[13px] font-medium text-ink hover:border-accent hover:text-accent transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11.5 4.5" />
          <path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07L12.5 19.5" />
        </svg>
        {copied ? 'Copied' : 'Copy booking link'}
      </button>
      {rows.length > 0 && (
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3.5 py-2 text-[13px] font-medium text-ink hover:border-accent hover:text-accent transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />
          </svg>
          Export
        </button>
      )}
      <a
        href={`/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        View page
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M7 17L17 7M8 7h9v9" />
        </svg>
      </a>
    </div>
  );
}

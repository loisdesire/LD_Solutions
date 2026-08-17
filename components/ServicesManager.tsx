'use client';

import { useState, useMemo } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  active: boolean;
  category: string | null;
};

type BookingStats = Record<string, { count: number; revenue: number }>;

const PAGE_SIZE = 10;

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `${h} hr` : `${h} hr ${rest} min`;
}

export default function ServicesManager({
  businessId,
  initialServices,
  bookingStats,
}: {
  businessId: string;
  initialServices: Service[];
  bookingStats: BookingStats;
}) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState('');
  const [editDraft, setEditDraft] = useState({ name: '', category: '', duration_minutes: 30, price: '' });
  const [editSaving, setEditSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(0);

  const supabase = createBrowserSupabase();

  const categories = useMemo(
    () => [...new Set(services.map((s) => s.category).filter((c): c is string => Boolean(c)))].sort(),
    [services]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return services.filter((s) => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (query && !s.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [services, search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const mostPopular = useMemo(() => {
    let best: Service | null = null;
    let bestCount = 0;
    for (const s of services) {
      const c = bookingStats[s.id]?.count ?? 0;
      if (c > bestCount) {
        best = s;
        bestCount = c;
      }
    }
    return bestCount > 0 ? best : null;
  }, [services, bookingStats]);

  const highestRevenue = useMemo(() => {
    let best: Service | null = null;
    let bestRevenue = 0;
    for (const s of services) {
      const r = bookingStats[s.id]?.revenue ?? 0;
      if (r > bestRevenue) {
        best = s;
        bestRevenue = r;
      }
    }
    return bestRevenue > 0 ? { service: best, revenue: bestRevenue } : null;
  }, [services, bookingStats]);

  const avgDuration =
    services.length > 0
      ? Math.round(services.reduce((sum, s) => sum + s.duration_minutes, 0) / services.length)
      : null;

  function handleExportCsv() {
    const header = ['Service', 'Category', 'Duration (min)', 'Price', 'Status'];
    const lines = filtered.map((s) =>
      [s.name, s.category ?? '', s.duration_minutes, s.price ?? '', s.active ? 'Active' : 'Hidden']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'services.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const { data, error: insertError } = await supabase
      .from('services')
      .insert({
        business_id: businessId,
        name,
        category: category.trim() || null,
        duration_minutes: duration,
        price: price ? Number(price) : null,
      })
      .select()
      .single();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setServices((prev) => [...prev, data]);
    setName('');
    setCategory('');
    setDuration(30);
    setPrice('');
    setShowAdd(false);
  }

  async function handleToggleActive(service: Service) {
    const { error: updateError } = await supabase
      .from('services')
      .update({ active: !service.active })
      .eq('id', service.id);

    if (!updateError) {
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, active: !s.active } : s))
      );
    }
  }

  async function handleDelete(id: string) {
    const { error: deleteError } = await supabase.from('services').delete().eq('id', id);
    if (!deleteError) {
      setServices((prev) => prev.filter((s) => s.id !== id));
    }
  }

  function startEdit(service: Service) {
    setEditingId(service.id);
    setEditDraft({
      name: service.name,
      category: service.category ?? '',
      duration_minutes: service.duration_minutes,
      price: service.price ? String(service.price) : '',
    });
  }

  async function saveEdit(id: string) {
    setEditSaving(true);
    setError('');

    const { error: updateError } = await supabase
      .from('services')
      .update({
        name: editDraft.name,
        category: editDraft.category.trim() || null,
        duration_minutes: editDraft.duration_minutes,
        price: editDraft.price ? Number(editDraft.price) : null,
      })
      .eq('id', id);

    setEditSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setServices((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              name: editDraft.name,
              category: editDraft.category.trim() || null,
              duration_minutes: editDraft.duration_minutes,
              price: editDraft.price ? Number(editDraft.price) : null,
            }
          : s
      )
    );
    setEditingId('');
  }

  const inputClass =
    'w-full rounded-xl border-2 border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';
  const smallInputClass =
    'rounded-xl border-2 border-line-strong bg-surface px-3 py-1.5 text-[13.5px] text-ink outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';
  const labelClass = 'font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5';
  const iconBtnClass =
    'h-8 w-8 flex items-center justify-center rounded-full border-2 border-line-strong text-ink-soft hover:border-accent hover:text-accent transition-colors';
  const pillClass = (active: boolean) =>
    `px-3.5 py-1.5 rounded-full font-mono text-[11px] transition-colors ${
      active ? 'text-white' : 'text-ink-faint hover:text-ink'
    }`;

  return (
    <div className="print:[&_.no-print]:hidden">
      <div className="flex justify-end mb-4 no-print">
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {showAdd ? 'Cancel' : 'Add service'}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr_1fr_auto] gap-4 items-end border-2 border-line rounded-2xl p-5 mb-4 bg-surface no-print"
        >
          <div>
            <label className={labelClass}>Service name</label>
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Haircut"
            />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
              placeholder="Optional"
              list="category-suggestions"
            />
            <datalist id="category-suggestions">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Duration (min)</label>
            <input
              required
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Price</label>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
              placeholder="Optional"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-error mb-4">{error}</p>}

      {services.length === 0 ? (
        <div className="border-2 border-dashed border-line-strong rounded-3xl p-10 text-center sm:p-14">
          <div className="mx-auto mb-5 h-12 w-12 rounded-2xl bg-accent-soft flex items-center justify-center text-accent">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
              <path
                d="M12 3L14.4 9.2L21 9.9L16 14.3L17.5 21L12 17.6L6.5 21L8 14.3L3 9.9L9.6 9.2L12 3Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="font-display text-[20px]">No services yet</h2>
          <p className="text-ink-soft text-[13.5px] mt-1.5">Add your first one above.</p>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-line overflow-hidden bg-surface">
          <div className="p-4 border-b border-line flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-1 bg-paper rounded-full p-1">
              <button
                onClick={() => {
                  setCategoryFilter('all');
                  setPage(0);
                }}
                className={pillClass(categoryFilter === 'all')}
                style={categoryFilter === 'all' ? { background: 'var(--accent)' } : undefined}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCategoryFilter(c);
                    setPage(0);
                  }}
                  className={pillClass(categoryFilter === c)}
                  style={categoryFilter === c ? { background: 'var(--accent)' } : undefined}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-paper rounded-full px-3.5 py-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-faint shrink-0">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Search services…"
                  className="bg-transparent border-none outline-none text-[13px] text-ink placeholder-ink-faint w-36"
                />
              </div>
              <button
                onClick={handleExportCsv}
                aria-label="Export CSV"
                title="Export CSV"
                className={iconBtnClass}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />
                </svg>
              </button>
              <button
                onClick={() => window.print()}
                aria-label="Print"
                title="Print"
                className={iconBtnClass}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="hidden sm:grid grid-cols-[1.6fr_1fr_1fr_1fr_100px] gap-4 px-5 py-3 bg-paper border-b border-line font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            <div>Service</div>
            <div>Duration</div>
            <div>Price</div>
            <div>Status</div>
            <div className="no-print" />
          </div>
          {paged.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13.5px] text-ink-faint">
              No services match {search ? 'that search' : 'this category'}.
            </div>
          ) : (
            paged.map((s, i) =>
            editingId === s.id ? (
              <div
                key={s.id}
                className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-3 bg-accent-soft/40 ${
                  i !== paged.length - 1 ? 'border-b border-line' : ''
                }`}
              >
                <input
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                  className={`${smallInputClass} flex-1`}
                />
                <input
                  value={editDraft.category}
                  onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                  placeholder="Category"
                  className={`${smallInputClass} w-28`}
                />
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={editDraft.duration_minutes}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, duration_minutes: Number(e.target.value) }))
                  }
                  className={`${smallInputClass} w-24`}
                />
                <input
                  type="number"
                  min={0}
                  value={editDraft.price}
                  onChange={(e) => setEditDraft((d) => ({ ...d, price: e.target.value }))}
                  placeholder="Price"
                  className={`${smallInputClass} w-28`}
                />
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => saveEdit(s.id)}
                    disabled={editSaving}
                    className="rounded-xl bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
                  >
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingId('')}
                    className="rounded-xl border-2 border-line-strong px-4 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={s.id}
                className={`flex flex-col gap-2.5 sm:grid sm:grid-cols-[1.6fr_1fr_1fr_1fr_100px] sm:gap-4 sm:items-center px-5 py-4 ${
                  i !== paged.length - 1 ? 'border-b border-line' : ''
                } ${!s.active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between sm:justify-start gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="hidden sm:flex h-8 w-8 rounded-xl items-center justify-center shrink-0"
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M9 12l2 2 4-4" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-[14.5px] truncate">{s.name}</p>
                      {s.category && (
                        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">{s.category}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`sm:hidden inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] shrink-0 ${
                      s.active ? 'bg-success-bg text-success' : 'bg-ink/5 text-ink-faint'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {s.active ? 'Active' : 'Hidden'}
                  </span>
                </div>
                <div className="font-mono text-[13px] text-ink-soft">
                  {formatDuration(s.duration_minutes)}
                  {s.price != null && <span className="sm:hidden"> · ₦{s.price.toLocaleString()}</span>}
                </div>
                <div className="hidden sm:block font-semibold text-[13.5px]" style={{ color: 'var(--accent)' }}>
                  {s.price != null ? `₦${s.price.toLocaleString()}` : '—'}
                </div>
                <div className="hidden sm:block">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] ${
                      s.active ? 'bg-success-bg text-success' : 'bg-ink/5 text-ink-faint'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {s.active ? 'Active' : 'Hidden'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 no-print">
                  <button
                    onClick={() => startEdit(s)}
                    aria-label="Edit"
                    className={iconBtnClass}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleToggleActive(s)}
                    aria-label={s.active ? 'Hide' : 'Show'}
                    className={iconBtnClass}
                  >
                    {s.active ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 5.1A9.9 9.9 0 0112 5c6.5 0 10 7 10 7a17.3 17.3 0 01-3.4 4.6M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a10 10 0 004.4-1" />
                        <path d="M9.9 9.9a3 3 0 004.2 4.2" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    aria-label="Delete"
                    className={`${iconBtnClass} hover:border-error hover:text-error`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                    </svg>
                  </button>
                </div>
              </div>
            )
            )
          )}

          {filtered.length > PAGE_SIZE && (
            <div className="px-5 py-3 border-t border-line flex items-center justify-between text-ink-faint no-print">
              <p className="font-mono text-[11px]">
                Showing {currentPage * PAGE_SIZE + 1} to {Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of{' '}
                {filtered.length}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border-2 border-line-strong disabled:opacity-30 hover:bg-paper transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <span className="font-mono text-[11px] px-1">{currentPage + 1} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border-2 border-line-strong disabled:opacity-30 hover:bg-paper transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {services.length > 0 && (mostPopular || highestRevenue || avgDuration != null) && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
          <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: 'var(--accent-soft)' }}>
            <div
              className="h-11 w-11 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 6l-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></svg>
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Most booked</p>
              <h4 className="font-display text-[16px] font-semibold text-ink truncate">
                {mostPopular ? mostPopular.name : 'No bookings yet'}
              </h4>
            </div>
          </div>
          <div className="rounded-2xl p-5 flex items-center gap-4 bg-surface border-2 border-line">
            <div
              className="h-11 w-11 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Highest revenue</p>
              <h4 className="font-display text-[16px] font-semibold text-ink truncate">
                {highestRevenue?.service ? highestRevenue.service.name : 'No bookings yet'}
              </h4>
            </div>
          </div>
          <div className="rounded-2xl p-5 flex items-center gap-4 bg-surface border-2 border-line">
            <div
              className="h-11 w-11 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Avg. duration</p>
              <h4 className="font-display text-[16px] font-semibold text-ink truncate">
                {avgDuration != null ? formatDuration(avgDuration) : '—'}
              </h4>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

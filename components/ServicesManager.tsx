'use client';

import { useState, useMemo, useId } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import { useToast } from './Toast';
import { friendlyError } from '@/lib/friendlyError';
import { formatMoney } from '@/lib/formatMoney';
import PillTabs from './PillTabs';
import { useDialog } from './useDialog';
import { inputClass, smallInputClass, labelClass, iconBtnClass } from './formStyles';
import ConfirmDialog from './ConfirmDialog';

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

function AddServiceModal({
  name,
  setName,
  category,
  setCategory,
  duration,
  setDuration,
  price,
  setPrice,
  categories,
  saving,
  error,
  onSubmit,
  onClose,
}: {
  name: string;
  setName: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  duration: number;
  setDuration: (v: number) => void;
  price: string;
  setPrice: (v: string) => void;
  categories: string[];
  saving: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  const dialogRef = useDialog(true, onClose);
  const nameId = useId();
  const categoryId = useId();
  const durationId = useId();
  const priceId = useId();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Add service"
      ref={dialogRef}
    >
      <div
        className="absolute inset-0 backdrop-blur-sm animate-fade"
        style={{ background: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl bg-surface border-2 border-line shadow-[0_30px_70px_-25px_rgba(36,28,24,0.45)] animate-rise">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-display text-[19px] font-semibold text-ink">Add service</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-full flex items-center justify-center text-ink-faint hover:bg-paper hover:text-ink transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor={nameId} className={labelClass}>Service name</label>
            <input
              id={nameId}
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Haircut"
            />
          </div>
          <div>
            <label htmlFor={categoryId} className={labelClass}>Category</label>
            <input
              id={categoryId}
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={durationId} className={labelClass}>Duration (min)</label>
              <input
                id={durationId}
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
              <label htmlFor={priceId} className={labelClass}>Price</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint text-[13px] pointer-events-none">
                  ₦
                </span>
                <input
                  id={priceId}
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={`${inputClass} pl-7`}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-accent px-5 py-3 text-body-sm font-semibold text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save service'}
          </button>
        </form>
      </div>
    </div>
  );
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
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(0);

  const supabase = createBrowserSupabase();
  const showToast = useToast();

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
      setError(friendlyError(insertError));
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
      showToast(service.active ? `${service.name} hidden from your booking page` : `${service.name} is bookable again`);
    } else {
      showToast('Could not update that service', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('services').delete().eq('id', id);
    setDeleting(false);
    setDeleteTarget(null);
    if (!deleteError) {
      setServices((prev) => prev.filter((s) => s.id !== id));
      showToast(`${name} deleted`);
    } else {
      showToast('Could not delete that service', 'error');
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
      setError(friendlyError(updateError));
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

  return (
    <div className="print:[&_.no-print]:hidden">
      <div className="flex justify-end mb-4 no-print">
        <button
          onClick={() => {
            setError('');
            setShowAdd(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-body-sm font-semibold text-accent-contrast shadow-sm transition-all hover:opacity-90 active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add service
        </button>
      </div>

      {/* A modal, not an inline-expanding form - it used to push every row
          in the table down the page the instant you opened it, and back up
          the instant you closed it. Reuses the same dialog shell
          (useDialog: focus trap, Escape, scroll lock) as NewAppointmentModal. */}
      {showAdd && (
        <AddServiceModal
          name={name}
          setName={setName}
          category={category}
          setCategory={setCategory}
          duration={duration}
          setDuration={setDuration}
          price={price}
          setPrice={setPrice}
          categories={categories}
          saving={saving}
          error={error}
          onSubmit={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}

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
          <h2 className="font-display text-[20px]">Nothing bookable yet</h2>
          <p className="text-ink-soft text-body-sm mt-1.5">Services are what customers pick from when they book - until you add one, your booking page has nothing to offer. Use "Add service" above to start.</p>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-line overflow-hidden bg-surface">
          <div className="p-4 border-b border-line flex flex-wrap items-center justify-between gap-3 no-print">
            <PillTabs
              options={[{ key: 'all', label: 'All' }, ...categories.map((c) => ({ key: c, label: c }))]}
              active={categoryFilter}
              onChange={(key) => {
                setCategoryFilter(key);
                setPage(0);
              }}
            />
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
                  className="bg-transparent border-none outline-none rounded-lg px-1 -mx-1 text-[13px] text-ink placeholder-ink-faint w-36"
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

          <div className="hidden sm:grid grid-cols-[1.6fr_1fr_1fr_1fr_100px] gap-4 px-5 py-3 bg-paper border-b border-line font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-faint">
            <div>Service</div>
            <div>Duration</div>
            <div>Price</div>
            <div>Status</div>
            <div className="no-print" />
          </div>
          {paged.length === 0 ? (
            <div className="px-5 py-10 text-center text-body-sm text-ink-faint">
              No services match {search ? 'that search' : 'this category'}.
            </div>
          ) : (
            paged.map((s, i) =>
            editingId === s.id ? (
              <div
                key={s.id}
                className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-3 ${
                  i !== paged.length - 1 ? 'border-b border-line' : ''
                }`}
                style={{ background: 'color-mix(in srgb, var(--accent) 4%, var(--surface))' }}
              >
                <input
                  aria-label="Service name"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                  className={`${smallInputClass} flex-1`}
                />
                <input
                  aria-label="Category"
                  value={editDraft.category}
                  onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                  placeholder="Category"
                  className={`${smallInputClass} w-28`}
                />
                <input
                  type="number"
                  min={5}
                  step={5}
                  aria-label="Duration in minutes"
                  value={editDraft.duration_minutes}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, duration_minutes: Number(e.target.value) }))
                  }
                  className={`${smallInputClass} w-24`}
                />
                <div className="relative w-28">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint text-[12.5px] pointer-events-none">
                    ₦
                  </span>
                  <input
                    type="number"
                    min={0}
                    aria-label="Price"
                    value={editDraft.price}
                    onChange={(e) => setEditDraft((d) => ({ ...d, price: e.target.value }))}
                    placeholder="Price"
                    className={`${smallInputClass} w-full pl-6`}
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => saveEdit(s.id)}
                    disabled={editSaving}
                    className="rounded-xl bg-accent px-4 py-1.5 text-caption font-semibold text-accent-contrast disabled:opacity-50"
                  >
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingId('')}
                    className="rounded-xl border-2 border-line-strong px-4 py-1.5 text-caption font-medium text-ink-soft hover:text-ink transition-colors"
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
                        <p className="font-mono text-[11.5px] uppercase tracking-[0.05em] text-ink-faint">{s.category}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`sm:hidden inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11.5px] uppercase tracking-[0.05em] shrink-0 ${
                      s.active ? 'bg-success-bg text-success' : 'bg-ink-wash text-ink-faint'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {s.active ? 'Active' : 'Hidden'}
                  </span>
                </div>
                <div className="font-mono text-[13px] text-ink-soft">
                  {formatDuration(s.duration_minutes)}
                  {s.price != null && <span className="sm:hidden"> · {formatMoney(s.price)}</span>}
                </div>
                <div className="hidden sm:block font-semibold text-body-sm" style={{ color: 'var(--accent)' }}>
                  {formatMoney(s.price)}
                </div>
                <div className="hidden sm:block">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11.5px] uppercase tracking-[0.05em] ${
                      s.active ? 'bg-success-bg text-success' : 'bg-ink-wash text-ink-faint'
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
                    onClick={() => setDeleteTarget(s)}
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
              <p className="font-mono text-label">
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
                <span className="font-mono text-label px-1">{currentPage + 1} / {totalPages}</span>
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
                {avgDuration != null ? formatDuration(avgDuration) : '-'}
              </h4>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete service?"
        message={`Delete ${deleteTarget?.name ?? 'this service'}? This can't be undone.`}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

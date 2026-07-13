'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  active: boolean;
};

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `${h} hr` : `${h} hr ${rest} min`;
}

export default function ServicesManager({
  businessId,
  initialServices,
}: {
  businessId: string;
  initialServices: Service[];
}) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState('');
  const [editDraft, setEditDraft] = useState({ name: '', duration_minutes: 30, price: '' });
  const [editSaving, setEditSaving] = useState(false);

  const supabase = createBrowserSupabase();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const { data, error: insertError } = await supabase
      .from('services')
      .insert({
        business_id: businessId,
        name,
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
              duration_minutes: editDraft.duration_minutes,
              price: editDraft.price ? Number(editDraft.price) : null,
            }
          : s
      )
    );
    setEditingId('');
  }

  const inputClass =
    'w-full rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';
  const smallInputClass =
    'rounded-md border border-line-strong bg-surface px-3 py-1.5 text-[13.5px] text-ink outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';
  const labelClass = 'font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5';
  const iconBtnClass =
    'h-8 w-8 flex items-center justify-center rounded-md border border-line-strong text-ink-soft hover:border-accent hover:text-accent transition-colors';

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {showAdd ? 'Cancel' : 'Add service'}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-4 items-end border border-line-strong rounded-md p-5 mb-4 bg-paper"
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
            className="rounded-md bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {services.length === 0 ? (
        <div className="border border-dashed border-line-strong rounded-md p-10 text-center sm:p-14">
          <div className="mx-auto mb-5 h-12 w-12 rounded-md bg-accent-soft flex items-center justify-center text-accent">
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
        <div className="border border-line rounded-md overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1.6fr_1fr_1fr_1fr_90px] gap-4 px-5 py-2.5 bg-paper border-b border-line font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            <div>Service</div>
            <div>Duration</div>
            <div>Price</div>
            <div>Status</div>
            <div />
          </div>
          {services.map((s, i) =>
            editingId === s.id ? (
              <div
                key={s.id}
                className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-3 bg-accent-soft/40 ${
                  i !== services.length - 1 ? 'border-b border-line' : ''
                }`}
              >
                <input
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                  className={`${smallInputClass} flex-1`}
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
                    className="rounded-md bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
                  >
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingId('')}
                    className="rounded-md border border-line-strong px-4 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={s.id}
                className={`flex flex-col gap-2.5 sm:grid sm:grid-cols-[1.6fr_1fr_1fr_1fr_90px] sm:gap-4 sm:items-center px-5 py-4 ${
                  i !== services.length - 1 ? 'border-b border-line' : ''
                } ${!s.active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between sm:block">
                  <p className="font-semibold text-[14.5px]">{s.name}</p>
                  <span
                    className={`sm:hidden inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] ${
                      s.active ? 'bg-emerald-50 text-emerald-700' : 'bg-ink/5 text-ink-faint'
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
                <div className="hidden sm:block font-mono text-[13px]">
                  {s.price != null ? `₦${s.price.toLocaleString()}` : '—'}
                </div>
                <div className="hidden sm:block">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] ${
                      s.active ? 'bg-emerald-50 text-emerald-700' : 'bg-ink/5 text-ink-faint'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {s.active ? 'Active' : 'Hidden'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
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
                    className={`${iconBtnClass} hover:border-red-300 hover:text-red-600`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

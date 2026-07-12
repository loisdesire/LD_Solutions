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

export default function ServicesManager({
  businessId,
  initialServices,
}: {
  businessId: string;
  initialServices: Service[];
}) {
  const [services, setServices] = useState<Service[]>(initialServices);
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
    'w-full rounded-xl border border-line bg-white px-4 py-3 text-ink placeholder-muted/60 shadow-sm outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent/10';
  const smallInputClass =
    'rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink shadow-sm outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent/10';
  const labelClass = 'block text-sm font-medium text-ink mb-1.5';

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleAdd}
        className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-4 items-end rounded-2xl border border-line bg-white p-6 shadow-soft"
      >
        <div>
          <label className={labelClass}>Service name</label>
          <input
            required
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
          className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:brightness-110 disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? 'Adding…' : 'Add service'}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {services.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-line bg-white/50">
          <p className="text-lg font-semibold">No services yet</p>
          <p className="text-muted text-sm mt-1">Add your first one above.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {services.map((s) =>
            editingId === s.id ? (
              <li
                key={s.id}
                className="flex flex-col gap-3 rounded-2xl border border-accent bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:gap-3"
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
                    className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white shadow-glow disabled:opacity-50"
                  >
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingId('')}
                    className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-muted hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={s.id}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-muted text-sm">
                    {s.duration_minutes} min{s.price ? ` · ₦${s.price}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => handleToggleActive(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      s.active ? 'bg-accent/10 text-accent' : 'bg-ink/5 text-muted'
                    }`}
                  >
                    {s.active ? 'Active' : 'Hidden'}
                  </button>
                  <button
                    onClick={() => startEdit(s)}
                    className="text-sm text-muted hover:text-ink transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-sm text-muted hover:text-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

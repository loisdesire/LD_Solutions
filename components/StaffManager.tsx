'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';

type StaffRow = { id: string; name: string; email: string; role: string; auth_id: string | null };
type Invite = { id: string; email: string; token: string };

export default function StaffManager({
  businessId,
  businessName,
  slug,
  currentUserId,
  initialStaff,
  initialInvites,
}: {
  businessId: string;
  businessName: string;
  slug: string;
  currentUserId: string;
  initialStaff: StaffRow[];
  initialInvites: Invite[];
}) {
  const [staff, setStaff] = useState<StaffRow[]>(initialStaff);
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const supabase = createBrowserSupabase();

  function inviteUrl(token: string) {
    return `${window.location.origin}/${slug}/accept-invite?token=${token}`;
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const { data, error: insertError } = await supabase
      .from('staff_invites')
      .insert({ business_id: businessId, email })
      .select()
      .single();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setInvites((prev) => [...prev, data]);
    setEmail('');

    fetch('/api/staff/notify-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        businessName,
        inviteUrl: inviteUrl(data.token),
      }),
    }).catch(() => {});
  }

  function handleCopy(token: string, id: string) {
    navigator.clipboard.writeText(inviteUrl(token));
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 1500);
  }

  async function handleRemove(id: string) {
    const { error: deleteError } = await supabase.from('staff').delete().eq('id', id);
    if (!deleteError) {
      setStaff((prev) => prev.filter((s) => s.id !== id));
    }
  }

  const inputClass =
    'w-full rounded-xl border border-line bg-white px-4 py-3 text-ink placeholder-muted/60 shadow-sm outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent/10';

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleInvite}
        className="flex flex-col sm:flex-row gap-4 items-end rounded-2xl border border-line bg-white p-6 shadow-soft"
      >
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-ink mb-1.5">
            Invite by email
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="teammate@example.com"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:brightness-110 disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? 'Sending…' : 'Send invite'}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
          Team
        </h2>
        <ul className="space-y-3">
          {staff.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-white p-5 shadow-sm"
            >
              <div className="h-9 w-9 shrink-0 rounded-full bg-brand flex items-center justify-center text-white text-sm font-semibold">
                {s.email[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{s.email}</p>
              </div>
              <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-xs font-medium capitalize text-muted">
                {s.role}
              </span>
              {s.auth_id !== currentUserId && (
                <button
                  onClick={() => handleRemove(s.id)}
                  className="text-sm text-muted hover:text-red-600 transition-colors shrink-0"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {invites.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            Pending invites
          </h2>
          <ul className="space-y-3">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-white/50 p-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{inv.email}</p>
                  <p className="text-muted text-xs">Waiting to accept</p>
                </div>
                <button
                  onClick={() => handleCopy(inv.token, inv.id)}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink hover:border-accent hover:text-accent transition-all shrink-0"
                >
                  {copiedId === inv.id ? 'Copied ✓' : 'Copy link'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

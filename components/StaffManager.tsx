'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import CheckIcon from './CheckIcon';

type StaffRow = { id: string; name: string; email: string; role: string; auth_id: string | null };
type Invite = { id: string; email: string; token: string };

const AVATAR_COLORS = ['#B5502F', '#2F5D42', '#38416B', '#A8792B', '#6B3450', '#2F6F62'];

function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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
    'w-full rounded-xl border-2 border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';

  return (
    <div>
      <form
        onSubmit={handleInvite}
        className="flex flex-col sm:flex-row gap-3 items-end border-2 border-dashed border-line-strong rounded-2xl p-5 mb-8 bg-surface"
      >
        <div className="flex-1 w-full">
          <label className="font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5">
            Invite by email
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="colleague@example.com"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? 'Sending…' : 'Send invite'}
        </button>
      </form>

      {error && <p className="text-sm text-error mb-4">{error}</p>}

      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-3">
        Team
      </div>
      <div className="space-y-2 mb-8">
        {staff.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3.5 border-2 border-line rounded-2xl p-4 bg-surface"
          >
            <div
              className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-white text-[14px] font-semibold"
              style={{ background: avatarColor(s.email) }}
            >
              {s.email[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[14px] truncate">{s.email}</p>
            </div>
            <span className="font-mono rounded-full bg-ink-wash px-2.5 py-0.5 text-[10.5px] uppercase tracking-[0.05em] text-ink-faint">
              {s.role}
            </span>
            {s.auth_id !== currentUserId && (
              <button
                onClick={() => handleRemove(s.id)}
                className="text-[13px] text-ink-faint hover:text-error transition-colors shrink-0"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {invites.length > 0 && (
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-3">
            Pending invites
          </div>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 border-2 border-dashed border-line-strong rounded-2xl p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[14px] truncate">{inv.email}</p>
                  <p className="font-mono text-ink-faint text-[11px] mt-0.5">Waiting to accept</p>
                </div>
                <button
                  onClick={() => handleCopy(inv.token, inv.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border-2 border-line-strong px-3 py-1.5 text-[12.5px] font-medium text-ink hover:border-accent hover:text-accent transition-all shrink-0"
                >
                  {copiedId === inv.id ? (
                    <>
                      Copied <CheckIcon className="h-3 w-3" />
                    </>
                  ) : (
                    'Copy link'
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

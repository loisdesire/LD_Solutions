'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import CheckIcon from './CheckIcon';
import { useToast } from './Toast';
import { inputClass, smallInputClass, iconBtnClass, labelClass } from './formStyles';

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
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const [editingId, setEditingId] = useState('');
  const [editName, setEditName] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const supabase = createBrowserSupabase();
  const showToast = useToast();

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
    setShowInvite(false);
    showToast(`Invite sent to ${data.email}`);

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
    const member = staff.find((s) => s.id === id);
    if (!confirm(`Remove ${member?.name ?? 'this person'} from your team? They'll lose access immediately.`)) return;
    const { error: deleteError } = await supabase.from('staff').delete().eq('id', id);
    if (!deleteError) {
      setStaff((prev) => prev.filter((s) => s.id !== id));
      showToast(`${member?.name ?? 'Team member'} removed`);
    } else {
      showToast('Could not remove that team member', 'error');
    }
  }

  function startEdit(member: StaffRow) {
    setEditingId(member.id);
    setEditName(member.name);
  }

  // Name only, not role - role changes have real access-control
  // implications (owner vs. staff) that a quick inline edit isn't the
  // right place to make casually; that stays a deliberate, separate
  // action if it's ever added.
  async function saveEdit(id: string) {
    setEditSaving(true);
    const { error: updateError } = await supabase.from('staff').update({ name: editName }).eq('id', id);
    setEditSaving(false);

    if (updateError) {
      showToast('Could not update that team member', 'error');
      return;
    }
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, name: editName } : s)));
    setEditingId('');
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowInvite((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-body-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {showInvite ? 'Cancel' : 'Invite someone'}
        </button>
      </div>

      {showInvite && (
        <form
          onSubmit={handleInvite}
          className="flex flex-col sm:flex-row gap-3 items-end border-2 border-line rounded-2xl p-5 mb-8 bg-surface"
        >
          <div className="flex-1 w-full">
            <label className={labelClass}>Invite by email</label>
            <input
              required
              autoFocus
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
            className="rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? 'Sending…' : 'Send invite'}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-error mb-4">{error}</p>}

      <div className="font-mono text-label uppercase tracking-[0.14em] text-ink-faint mb-3">
        Team
      </div>
      <div className="space-y-2 mb-8">
        {staff.length === 0 && (
          <p className="text-ink-soft text-body-sm py-3">
            No one on the team yet. Invite a staff member and they&apos;ll be able to see the calendar and manage
            their own bookings.
          </p>
        )}
        {staff.map((s) =>
          editingId === s.id ? (
            <div key={s.id} className="flex flex-col gap-3 border-2 border-line rounded-2xl p-4 bg-surface">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={smallInputClass}
                placeholder="Name"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit(s.id)}
                  disabled={editSaving || !editName.trim()}
                  className="rounded-xl bg-accent px-4 py-1.5 text-caption font-semibold text-white disabled:opacity-50"
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
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3.5 border-2 border-line rounded-2xl p-4 bg-surface"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div
                  className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[14px] truncate">{s.name}</p>
                  <p className="font-mono text-label text-ink-faint truncate mt-0.5">{s.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 pl-[52px] sm:pl-0">
                <span className="font-mono rounded-full bg-ink-wash px-2.5 py-0.5 text-[10.5px] uppercase tracking-[0.05em] text-ink-faint">
                  {s.role}
                </span>
                <button onClick={() => startEdit(s)} aria-label="Edit" className={iconBtnClass}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                {s.auth_id !== currentUserId && (
                  <button
                    onClick={() => handleRemove(s.id)}
                    className="text-[13px] text-ink-faint hover:text-error transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {invites.length > 0 && (
        <div>
          <div className="font-mono text-label uppercase tracking-[0.14em] text-ink-faint mb-3">
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
                  <p className="font-mono text-ink-faint text-label mt-0.5">Waiting to accept</p>
                </div>
                <button
                  onClick={() => handleCopy(inv.token, inv.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border-2 border-line-strong px-3 py-1.5 text-caption font-medium text-ink hover:border-accent hover:text-accent transition-all shrink-0"
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

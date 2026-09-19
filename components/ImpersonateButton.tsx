'use client';

import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

// Confirmed, not one click - this mints a real session as that business's
// actual owner. A misclick here isn't just navigation, it's briefly being
// logged in as someone else's account.
export default function ImpersonateButton({ slug }: { slug: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setPending(true);
    setError('');
    const res = await fetch('/api/super-admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    if (res.ok) {
      window.location.href = `/${slug}/admin`;
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? 'Could not impersonate this business.');
    setPending(false);
  }

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="text-[12.5px] font-semibold text-accent hover:underline"
      >
        Impersonate
      </button>
      {error && <p className="text-[11px] text-error mt-1">{error}</p>}
      <ConfirmDialog
        open={confirming}
        title="Log in as this business?"
        message={`This logs you in as this business's owner, in their real admin dashboard. Use "Back to site" in the header to return here afterward.`}
        confirmLabel="Log in as owner"
        pendingLabel="Logging in…"
        danger={false}
        pending={pending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

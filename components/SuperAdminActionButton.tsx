'use client';

import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

// Shared confirm-then-POST pattern for the non-navigating super-admin
// actions (force-reset, force-sign-out) - ImpersonateButton stays its own
// component since it navigates away on success instead of showing an
// inline result.
export default function SuperAdminActionButton({
  slug,
  endpoint,
  label,
  confirmTitle,
  confirmMessage,
  confirmLabel,
  pendingLabel,
  successMessage,
  danger,
}: {
  slug: string;
  endpoint: string;
  label: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel: string;
  pendingLabel: string;
  successMessage: string;
  danger?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleConfirm() {
    setPending(true);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    setConfirming(false);
    setResult(res.ok ? { ok: true, message: successMessage } : { ok: false, message: data.error ?? 'Something went wrong.' });
  }

  return (
    <div>
      <button onClick={() => setConfirming(true)} className="text-[12.5px] font-semibold text-accent hover:underline">
        {label}
      </button>
      {result && (
        <p className={`text-[11px] mt-1 ${result.ok ? 'text-success' : 'text-error'}`}>{result.message}</p>
      )}
      <ConfirmDialog
        open={confirming}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        pendingLabel={pendingLabel}
        danger={danger ?? false}
        pending={pending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

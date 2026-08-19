'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import CheckIcon from './CheckIcon';

export default function CustomDomainManager({
  businessId,
  initialCustomDomain,
}: {
  businessId: string;
  initialCustomDomain: string | null;
}) {
  const [domain, setDomain] = useState(initialCustomDomain ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const supabase = createBrowserSupabase();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    const cleaned = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '') || null;

    const { error: updateError } = await supabase
      .from('businesses')
      .update({ custom_domain: cleaned })
      .eq('id', businessId);

    setSaving(false);

    if (updateError) {
      // 23505 = unique_violation — someone else already has this domain
      // connected (or, much more likely, a typo re-submitting the same
      // domain twice while it's still pending DNS).
      if ((updateError as { code?: string }).code === '23505') {
        setError('That domain is already connected to a business.');
      } else if ((updateError as { code?: string }).code === '42703') {
        setError('Custom domains aren\'t enabled on this deployment yet — check back soon.');
      } else {
        setError(updateError.message);
      }
      return;
    }

    setDomain(cleaned ?? '');
    setSaved(true);
  }

  const inputClass =
    'w-full rounded-xl border-2 border-line-strong bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent-soft';
  const labelClass = 'font-mono block text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-1.5';

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <label className={labelClass}>Your domain</label>
        <input
          type="text"
          value={domain}
          // Every other manager clears its "Saved" badge on edit; this one
          // didn't, so the green "Saved" sat next to unsaved changes.
          onChange={(e) => {
            setDomain(e.target.value);
            setSaved(false);
          }}
          placeholder="book.yourbusiness.com"
          className={inputClass}
        />
        <p className="text-ink-faint text-[12.5px] mt-2 leading-relaxed">
          Point a domain or subdomain you own at your booking page — customers see it as your own address,
          nothing about the platform shows. This covers your public pages only (booking, about, gallery,
          contact); you'll still manage the business and log in from here.
        </p>
      </div>

      {domain && (
        <div className="rounded-xl bg-warm-surface p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint mb-2">Setup — two steps</p>
          <ol className="text-[13px] text-ink-soft space-y-2 list-decimal list-inside">
            <li>
              At your domain registrar, add a CNAME record for <span className="font-mono text-ink">{domain}</span> pointing
              to <span className="font-mono text-ink">cname.vercel-dns.com</span>.
            </li>
            <li>
              Message us the domain once you've saved it here — we add it to the hosting project on our end
              (a manual step, usually done within a day), and it goes live as soon as DNS propagates.
            </li>
          </ol>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save domain'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-success text-[13px] font-medium">
            <CheckIcon /> Saved
          </span>
        )}
        {error && <span className="text-error text-[13px]">{error}</span>}
      </div>
    </form>
  );
}

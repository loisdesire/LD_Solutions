'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/friendlyError';
import CheckIcon from './CheckIcon';
import Field from './Field';
import Icon from './Icon';
import { inputClass } from './formStyles';

// The host label a CNAME record needs: everything before the registrable
// domain (the last two labels), or "@" for an apex domain. Good enough for
// the common book.brand.com / brand.com cases; multi-part TLDs (.co.uk)
// would need a real PSL, which isn't worth it for a hint that also shows
// the full domain right next to it.
function cnameHost(domain: string): string {
  const labels = domain.split('.').filter(Boolean);
  return labels.length > 2 ? labels.slice(0, -2).join('.') : '@';
}

function CopyCell({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="group inline-flex items-center gap-1.5 font-mono text-[12.5px] text-ink hover:text-accent transition-colors"
    >
      {value}
      <Icon
        name={copied ? 'check' : 'content_copy'}
        size={13}
        className={copied ? 'text-success' : 'text-ink-faint group-hover:text-accent'}
      />
    </button>
  );
}

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
  const router = useRouter();

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
      // 23505 = unique_violation - someone else already has this domain
      // connected (or, much more likely, a typo re-submitting the same
      // domain twice while it's still pending DNS).
      if ((updateError as { code?: string }).code === '23505') {
        setError('That domain is already connected to a business.');
      } else if ((updateError as { code?: string }).code === '42703') {
        setError('Custom domains aren\'t switched on for your account yet. Check back soon.');
      } else {
        setError(friendlyError(updateError));
      }
      return;
    }

    setDomain(cleaned ?? '');
    setSaved(true);
    router.refresh();
  }

  const cleanedDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Field
        label="Domain"
        hint="A domain or subdomain you own. Customers see it as your own address - nothing about the platform shows. Covers your public pages only (booking, about, gallery, contact); you still log in and manage the business from here."
      >
        {(props) => (
          <input
            {...props}
            type="text"
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
              setSaved(false);
            }}
            placeholder="book.yourbusiness.com"
            className={inputClass}
          />
        )}
      </Field>

      {cleanedDomain.includes('.') && (
        <div className="border-t border-line pt-6">
          <h3 className="font-display text-[16px] font-semibold text-ink mb-1">DNS setup</h3>
          <p className="text-[12.5px] text-ink-faint mb-3">
            Add this record with your domain provider, then send us the domain so we can switch it on.
          </p>
          {/* The DNS record as a real TYPE / NAME / VALUE table, matching
              what every registrar's own form asks for - copy straight
              across. */}
          <div className="rounded-lg border border-line-strong overflow-hidden">
            <div className="grid grid-cols-[70px_1fr_1fr] bg-warm-surface px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
              <span>Type</span>
              <span>Name</span>
              <span>Value</span>
            </div>
            <div className="grid grid-cols-[70px_1fr_1fr] items-center px-3 py-2.5 border-t border-line">
              <span className="font-mono text-[12.5px] font-semibold text-ink">CNAME</span>
              <CopyCell value={cnameHost(cleanedDomain)} />
              <CopyCell value="cname.vercel-dns.com" />
            </div>
          </div>
          <p className="text-[12.5px] text-ink-faint mt-3 leading-relaxed">
            Once you&rsquo;ve added the record and saved here, we add the domain on our end (a manual step, usually
            within a day). It goes live as soon as DNS propagates - SSL is handled automatically after that.
          </p>
        </div>
      )}

      <div className="border-t border-line pt-5 flex items-center justify-end gap-3">
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-caption text-success">
            <CheckIcon className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {error && <span className="text-caption text-error">{error}</span>}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-4 text-[13px] font-semibold text-accent-contrast shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

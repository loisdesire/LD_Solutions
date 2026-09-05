import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { DEMO_SLUGS } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Pick a business to demo',
  description: 'See the real, working Vanova admin dashboard as the owner of a real demo business - no signup, nothing you touch is saved.',
  alternates: { canonical: '/demo' },
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Was: the homepage's only "see the dashboard" link went straight to
// /api/demo-login with no picker at all, hardcoded to one business
// (Glow Salon) - a visitor never got to choose, and "the demo" was really
// just one salon's dashboard regardless of what kind of business they
// actually run. This is the real thing the earlier "Try live demo" -> a
// scripted chat replay under the hero - was standing in for: pick a
// business, land in ITS real, live, write-blocked admin dashboard, no
// login form, no signup. /api/demo-login?slug=<slug> does the actual
// session-minting (see that route for why ?slug is validated against
// DEMO_SLUGS rather than trusted as-is).
export default async function DemoPickerPage() {
  const { data: businesses } = await supabaseAdmin
    .from('businesses')
    .select('slug, name, business_type, logo_url')
    .in('slug', DEMO_SLUGS);

  // Keep DEMO_SLUGS's own order (roughly "oldest/most complete first")
  // rather than whatever order the query happens to return.
  const ordered = DEMO_SLUGS.map((slug) => businesses?.find((b) => b.slug === slug)).filter(
    (b): b is NonNullable<typeof b> => Boolean(b)
  );

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Vanova" className="h-8 w-8 shrink-0 object-contain" />
            <span className="text-[15px] font-semibold text-ink tracking-tight">Vanova</span>
          </Link>
          <Link href="/" className="text-[13.5px] font-medium text-ink-soft hover:text-ink transition-colors">
            Back home
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-14 sm:py-16 text-center">
        <p className="text-[13px] font-semibold text-accent mb-2">Live demo</p>
        <h1 className="font-display text-[28px] sm:text-[32px] font-semibold text-ink tracking-tight mb-2.5">
          Pick a business to see it as the owner
        </h1>
        <p className="text-body-sm text-ink-soft mb-10 max-w-md mx-auto">
          Every one of these is a real, working business on Vanova. You&apos;ll land in its actual admin
          dashboard, logged in as the owner - real data, every screen. Nothing you touch is saved.
        </p>

        <div className="flex flex-col gap-3">
          {ordered.map((business) => (
            <a
              key={business.slug}
              href={`/api/demo-login?slug=${encodeURIComponent(business.slug)}`}
              className="flex items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-4 text-left transition-colors hover:border-accent"
            >
              {business.logo_url ? (
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-line">
                  <Image src={business.logo_url} alt="" fill sizes="48px" className="object-cover" />
                </div>
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-xl bg-warm-surface" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-display text-[16px] font-semibold text-ink truncate">{business.name}</p>
                {business.business_type && (
                  <p className="text-[12.5px] text-ink-faint truncate">{business.business_type}</p>
                )}
              </div>
              <span className="shrink-0 text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>
                See dashboard →
              </span>
            </a>
          ))}
        </div>

        {ordered.length === 0 && (
          <p className="text-body-sm text-ink-faint">No demo businesses are set up right now - check back soon.</p>
        )}
      </main>
    </div>
  );
}

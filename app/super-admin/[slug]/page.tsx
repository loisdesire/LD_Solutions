import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireSuperAdminSession } from '@/lib/requireSuperAdminSession';
import { getSubscriptionState } from '@/lib/subscription';
import ImpersonateButton from '@/components/ImpersonateButton';
import SuperAdminActionButton from '@/components/SuperAdminActionButton';
import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false } };

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PHASE_LABEL: Record<string, string> = {
  active: 'Active',
  cancelling: 'Cancelling',
  past_due: 'Past due',
  expired: 'Expired',
  none: 'No subscription',
};

const AUDIT_ACTION_LABEL: Record<string, string> = {
  impersonate: 'Impersonated',
  force_password_reset: 'Sent password reset',
  force_sign_out: 'Forced sign-out',
};

export default async function SuperAdminBusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireSuperAdminSession();
  const { slug } = await params;

  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('id, slug, name, business_type, logo_url, created_at, telegram_bot_token, whatsapp_access_token, flw_subaccount_id, custom_domain')
    .eq('slug', slug)
    .maybeSingle();

  if (!business) notFound();

  const [{ data: sub }, { count: bookingCount }, { data: lastBooking }, { data: services }, { data: staff }, { data: auditLog }] =
    await Promise.all([
      supabaseAdmin
        .from('subscriptions')
        .select('status, trial_ends_at, current_period_end, plan')
        .eq('business_id', business.id)
        .maybeSingle(),
      supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
      supabaseAdmin
        .from('bookings')
        .select('created_at')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin.from('services').select('id, name, active').eq('business_id', business.id),
      supabaseAdmin.from('staff').select('id, name, email, role').eq('business_id', business.id),
      supabaseAdmin
        .from('super_admin_audit_log')
        .select('id, actor_email, action, created_at')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

  const state = getSubscriptionState(sub);
  const missingLogo = !business.logo_url;

  return (
    <div>
      <Link href="/super-admin" className="text-[12.5px] font-medium text-accent hover:underline">
        ← All businesses
      </Link>

      <div className="mt-3 mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 text-ink">{business.name}</h1>
          <p className="text-ink-soft text-body-sm mt-1 font-mono">/{business.slug}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ImpersonateButton slug={business.slug} />
          <SuperAdminActionButton
            slug={business.slug}
            endpoint="/api/super-admin/force-password-reset"
            label="Send password reset"
            confirmTitle="Send a password reset link?"
            confirmMessage="Emails this business's owner a reset link, same as if they'd used Forgot password themselves."
            confirmLabel="Send link"
            pendingLabel="Sending…"
            successMessage="Reset link sent."
          />
          <SuperAdminActionButton
            slug={business.slug}
            endpoint="/api/super-admin/force-sign-out"
            label="Force sign-out"
            confirmTitle="Sign this owner out everywhere?"
            confirmMessage="Revokes every active session for this business's owner, on every device. They'll need to log in again."
            confirmLabel="Sign out"
            pendingLabel="Signing out…"
            successMessage="Owner signed out on all devices."
            danger
          />
        </div>
      </div>

      {missingLogo && (
        <div className="mb-6 rounded-xl border border-warning bg-warning-bg px-4 py-3 text-[13px] text-warning">
          No logo uploaded - this business is showing a placeholder icon to its own customers.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          {
            label: 'Subscription',
            value: state.phase === 'trial' ? `Trial, ${state.trialDaysLeft}d left` : PHASE_LABEL[state.phase] ?? state.phase,
          },
          { label: 'Total bookings', value: String(bookingCount ?? 0) },
          {
            label: 'Last booking',
            value: lastBooking ? new Date(lastBooking.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—',
          },
          { label: 'Created', value: new Date(business.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface p-3.5 sm:p-4">
            <div className="text-[10.5px] sm:text-[11px] font-semibold text-ink-faint uppercase tracking-wider truncate">
              {s.label}
            </div>
            <div className="mt-2 font-display text-[18px] sm:text-[20px] font-bold tracking-tight leading-tight text-ink truncate">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-display text-[17px] font-semibold text-ink mb-3">Channels & payments</h2>
      <div className="rounded-xl border border-line bg-surface divide-y divide-line mb-8">
        {[
          { label: 'Flutterwave (deposits)', connected: !!business.flw_subaccount_id },
          { label: 'Telegram', connected: !!business.telegram_bot_token },
          { label: 'WhatsApp', connected: !!business.whatsapp_access_token },
          { label: 'Custom domain', connected: !!business.custom_domain, detail: business.custom_domain },
        ].map((c) => (
          <div key={c.label} className="px-4 py-3 flex items-center justify-between">
            <span className="text-[13.5px] text-ink">{c.label}{c.detail ? ` — ${c.detail}` : ''}</span>
            <span
              className={`text-[11px] font-mono uppercase tracking-[0.05em] px-2 py-0.5 rounded-full ${
                c.connected ? 'bg-success-bg text-success' : 'bg-warm-surface text-ink-faint'
              }`}
            >
              {c.connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-8 mb-8">
        <div>
          <h2 className="font-display text-[17px] font-semibold text-ink mb-3">
            Services <span className="text-ink-faint font-normal">({services?.length ?? 0})</span>
          </h2>
          <div className="rounded-xl border border-line bg-surface divide-y divide-line">
            {(services ?? []).map((s) => (
              <div key={s.id} className="px-4 py-2.5 text-[13.5px] text-ink flex items-center justify-between">
                {s.name}
                {!s.active && <span className="text-[11px] text-ink-faint">Inactive</span>}
              </div>
            ))}
            {(!services || services.length === 0) && (
              <p className="px-4 py-6 text-center text-ink-faint text-body-sm">No services yet.</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="font-display text-[17px] font-semibold text-ink mb-3">
            Staff <span className="text-ink-faint font-normal">({staff?.length ?? 0})</span>
          </h2>
          <div className="rounded-xl border border-line bg-surface divide-y divide-line">
            {(staff ?? []).map((s) => (
              <div key={s.id} className="px-4 py-2.5 text-[13.5px] text-ink">
                <span className="font-medium">{s.name}</span>{' '}
                <span className="text-ink-faint">({s.role}) — {s.email}</span>
              </div>
            ))}
            {(!staff || staff.length === 0) && (
              <p className="px-4 py-6 text-center text-ink-faint text-body-sm">No staff yet.</p>
            )}
          </div>
        </div>
      </div>

      <h2 className="font-display text-[17px] font-semibold text-ink mb-3">Recent admin activity</h2>
      <div className="rounded-xl border border-line bg-surface divide-y divide-line">
        {(auditLog ?? []).map((a) => (
          <div key={a.id} className="px-4 py-2.5 text-[13px] text-ink-soft flex items-center justify-between gap-3">
            <span>
              <span className="font-medium text-ink">{AUDIT_ACTION_LABEL[a.action] ?? a.action}</span> by {a.actor_email}
            </span>
            <span className="text-ink-faint shrink-0">{new Date(a.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
        ))}
        {(!auditLog || auditLog.length === 0) && (
          <p className="px-4 py-6 text-center text-ink-faint text-body-sm">No admin actions on this business yet.</p>
        )}
      </div>
    </div>
  );
}

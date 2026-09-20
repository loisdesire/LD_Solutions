import { createClient } from '@supabase/supabase-js';
import { logError } from './logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Every sensitive /super-admin action writes one row here before (or
// immediately after) doing the thing itself - see schema.sql's
// super_admin_audit_log comment for why this exists. Best-effort: a
// logging failure should never be the reason a legitimate support action
// gets blocked, so callers fire-and-forget this rather than awaiting it
// as a precondition.
//
// The insert's own error was never checked - for most fire-and-forget
// writes elsewhere in the app that's a fine tradeoff, but this table's
// entire reason to exist is being the record of who impersonated which
// business and when; a write that silently failed here would be
// invisible everywhere, defeating that one guarantee. Routed through
// logError (with critical: true) specifically so a failure here reaches
// the same alert path a payment failure does, not stdout alone.
export async function logSuperAdminAction(params: {
  actorEmail: string;
  action: 'impersonate' | 'force_password_reset' | 'force_sign_out';
  businessId: string;
  businessSlug: string;
}) {
  const { error } = await supabaseAdmin.from('super_admin_audit_log').insert({
    actor_email: params.actorEmail,
    action: params.action,
    business_id: params.businessId,
    business_slug: params.businessSlug,
  });
  if (error) {
    logError('superAdminAudit:log', error, params, { critical: true });
  }
}

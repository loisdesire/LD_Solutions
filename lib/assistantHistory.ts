import { createClient } from '@supabase/supabase-js';
import type { AgentMessage } from './agentLoop';
import { logError } from './logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type AssistantChatKind = 'assistant' | 'onboarding';

// Restores a conversation after navigating away and back - without this,
// AssistantChat's messages live only in that component's React state, so
// clicking to another admin page mid-conversation (or just refreshing)
// wiped it entirely, including the AI's only record of what it had just
// proposed and was waiting to be confirmed.
//
// Both functions no-op quietly (return [] / do nothing) rather than throw
// if this table's migration hasn't been run yet on a given database -
// history just doesn't persist until then, same as every other
// not-yet-migrated fallback in this codebase.
const HISTORY_LIMIT = 40;

export async function getAssistantHistory(
  businessId: string,
  staffId: string,
  kind: AssistantChatKind
): Promise<AgentMessage[]> {
  const { data, error } = await supabaseAdmin
    .from('assistant_messages')
    .select('role, content')
    .eq('business_id', businessId)
    .eq('staff_id', staffId)
    .eq('kind', kind)
    .order('created_at', { ascending: true })
    .limit(HISTORY_LIMIT);

  if (error || !data) return [];
  return data as AgentMessage[];
}

export async function appendAssistantMessages(
  businessId: string,
  staffId: string,
  kind: AssistantChatKind,
  messages: AgentMessage[]
): Promise<void> {
  if (messages.length === 0) return;
  const { error } = await supabaseAdmin.from('assistant_messages').insert(
    messages.map((m) => ({ business_id: businessId, staff_id: staffId, kind, role: m.role, content: m.content }))
  );
  // A failure here must never fail the chat turn that already succeeded
  // and was already shown to the user - it just won't be there on the
  // next visit. The migration not having run yet is expected and silent -
  // confirmed live that PostgREST reports a missing table as PGRST205, not
  // Postgres's own 42P01 (that raw code only surfaces from a direct SQL
  // connection, never through the REST API this client actually uses).
  // Anything else is worth knowing about.
  if (error && error.code !== 'PGRST205') {
    logError('assistantHistory:append-failed', error, { businessId, staffId, kind });
  }
}

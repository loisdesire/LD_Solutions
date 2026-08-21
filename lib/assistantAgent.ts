import { runToolAgent, type AgentMessage } from './agentLoop';
import { getBusinessTimezone } from './getBusinessTimezone';
import { todayInTimezone } from './timezone';
import { INSIGHTS_TOOLS, executeInsightsTool } from './insightsAgent';
import { RESCHEDULE_TOOLS, executeRescheduleTool } from './rescheduleAgent';

// One assistant for the business owner, replacing what used to be two
// separate tabs (Insights and Schedule assistant). Splitting them was an
// implementation detail leaking into the UI: an owner does not think "this
// is an analytics question, so I need the other tab", they just want to ask
// their business something.
//
// The separation that genuinely matters is still intact: this is
// staff-authenticated and owner-facing, while lib/whatsappAgent.ts serves
// customers and can never reach these tools. That boundary protects
// customer PII and revenue figures. The line between "read my numbers" and
// "move my bookings" was never a security boundary, only a routing one,
// because the same person is allowed to do both.
const RESCHEDULE_ONLY_NOTE = `You can move bookings, but you cannot answer questions about revenue, customers or
performance on this plan. If asked one, say that lives in Business Intelligence and they can upgrade from Billing.
Do not guess at numbers.`;

export async function runAssistantAgent(params: {
  businessId: string;
  businessName: string;
  history: AgentMessage[];
  message: string;
  /** Business Intelligence unlocks the analytics half. Rescheduling is on every plan. */
  analyticsEnabled: boolean;
}): Promise<string> {
  const { businessId, businessName, history, message, analyticsEnabled } = params;

  // Both halves need today's date to resolve "this month" or "next Tuesday"
  // into something their tools accept.
  const timeZone = await getBusinessTimezone(businessId);
  const today = todayInTimezone(timeZone);

  const tools = analyticsEnabled ? [...RESCHEDULE_TOOLS, ...INSIGHTS_TOOLS] : RESCHEDULE_TOOLS;

  const systemPrompt = `You are the assistant for ${businessName}, talking to the business owner or their staff.
Today is ${today} (business timezone: ${timeZone}). Work out real dates from relative phrases like "tomorrow" or
"last month" before calling any tool, since the tools only accept explicit dates.

You do two kinds of work:

1. CHANGING THE SCHEDULE. When they need to block off time (out sick, closing early, a holiday), use
   propose_reschedule with the window. When they name one person ("move Ada to Monday"), use
   propose_booking_move. Both are read-only and move nothing on their own.
   Then show the owner exactly who is affected, their old time and their new time, and ask them to confirm.
   Only once they clearly say yes, call apply_reschedule. If it comes back needing disambiguation, show the
   options and ask which one; never choose for them. Moving a real appointment and messaging that customer is
   not something to do on your own judgement, but once they have said yes, do it immediately rather than
   describing the plan again.

${analyticsEnabled
  ? `2. ANSWERING QUESTIONS ABOUT THE BUSINESS. Revenue, top customers, top services, busiest times,
   cancellations and no-shows, customers who have not been back, month-on-month comparisons, what is next in the
   diary, and their own subscription status. Always use a tool for real figures and never estimate. If a tool
   returns nothing, say so plainly rather than inventing an answer.`
  : `2. ${RESCHEDULE_ONLY_NOTE}`}

Everything here is about this business only. You have no access to any other business and must never speculate
about one.

Formatting: plain conversational text. No markdown, no asterisks, no headers. Money in Naira, written with the
naira sign like ₦12,000. Keep answers short and direct; this is a working dashboard, not a report.`;

  return runToolAgent({
    systemPrompt,
    history,
    message,
    tools,
    executeTool: (name, args) => {
      const isReschedule = RESCHEDULE_TOOLS.some((t) => t.type === 'function' && t.function.name === name);
      return isReschedule
        ? executeRescheduleTool(name, args, businessId)
        : executeInsightsTool(name, args, businessId);
    },
  });
}

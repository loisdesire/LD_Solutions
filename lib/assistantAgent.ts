import { runToolAgent, stripMarkdown, type AgentMessage } from './agentLoop';
import { getBusinessTimezone } from './getBusinessTimezone';
import { todayInTimezone, upcomingDatesTable, weekdayName } from './timezone';
import { INSIGHTS_TOOLS, executeInsightsTool } from './insightsAgent';
import { RESCHEDULE_TOOLS, executeRescheduleTool } from './rescheduleAgent';
import { MANAGE_TOOLS, executeManageTool } from './manageAgent';
import { describeManageToolChange, notifyOwnerOfManageChange } from './notifyOwnerOfChange';
import { getBusinessContext } from './whatsappTools';
import { formatMoney } from './formatMoney';

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
  /** This business's slug, e.g. "glow-salon" - the base every real admin page path below is built from. */
  slug: string;
  history: AgentMessage[];
  message: string;
  /** Business Intelligence unlocks the analytics half. Rescheduling and managing the business are on every plan. */
  analyticsEnabled: boolean;
  /**
   * A URL from this same request's image upload (see AssistantChat.tsx),
   * already verified server-side (app/api/assistant/chat/route.ts) to
   * actually be one of this app's own Supabase Storage URLs before it ever
   * reaches here. Folded into the message text below rather than passed to
   * the model as a real image, since the model's job is to file the URL
   * onto a service record, not look at the photo.
   */
  imageUrl?: string | null;
}): Promise<string> {
  const { businessId, businessName, slug, history, analyticsEnabled, imageUrl } = params;
  const message = imageUrl ? `${params.message}\n\n[Attached image: ${imageUrl}]` : params.message;

  // Both halves need today's date to resolve "this month" or "next Tuesday"
  // into something their tools accept.
  const timeZone = await getBusinessTimezone(businessId);
  const today = todayInTimezone(timeZone);
  const datesTable = upcomingDatesTable(timeZone);

  // Reused from the customer-facing bot (lib/whatsappTools.ts) rather than
  // a second copy of the same query - this agent had NO read access to its
  // own basic facts at all before this: every hours-related tool here
  // (propose/apply_update_hours) only ever WRITES a change, so "what days
  // am I open" had no tool that could answer it and no context that
  // mentioned it either. Confirmed live: the owner's own assistant telling
  // the owner it doesn't have access to their own hours. Services and
  // weekly hours are cheap, always-relevant facts worth having up front
  // rather than a tool round-trip for something this basic - ai_context
  // deliberately left out of this prompt, that field exists specifically
  // for the CUSTOMER-facing bot to draw on, not for the owner to be told
  // their own backstory back.
  const { business, services, weeklyHours } = await getBusinessContext(businessId);

  const tools = analyticsEnabled
    ? [...RESCHEDULE_TOOLS, ...MANAGE_TOOLS, ...INSIGHTS_TOOLS]
    : [...RESCHEDULE_TOOLS, ...MANAGE_TOOLS];

  // formatMoney, not a bare s.price - the exact same underlying prompt
  // read as "₦2,000" in one conversation and bare "2000" in another
  // (confirmed live, same root cause on the customer-facing side), since
  // nothing here ever told the model Naira values need a currency symbol.
  const servicesLine = services.length
    ? services.map((s) => `${s.name} (${s.duration_minutes} min${s.price ? `, ${formatMoney(s.price)}` : ''})`).join(', ')
    : 'none configured yet';

  const systemPrompt = `You are the assistant for ${businessName}, talking to the business owner or their staff.
Today is ${weekdayName(today)}, ${today} (business timezone: ${timeZone}) - state this exact weekday when asked,
never work it out yourself. Work out real dates from relative phrases like "tomorrow" or
"last month" before calling any tool, since the tools only accept explicit dates. For a named weekday ("Tuesday",
"next Monday"), look it up here rather than calculating it by hand - this is already correct, and multi-step date
arithmetic is exactly the kind of thing that goes wrong without it:
${datesTable}

Current weekly hours: ${weeklyHours.join(', ')}.
Active services: ${servicesLine}.
Answer direct questions about either of these ("what days am I open", "what do I charge for X") straight from
the lists above - no tool call needed, and never say you don't have access to this. Only use the change-hours or
change-a-service tools when they actually want something changed, not just to look something up.${
    business?.contact_phone || business?.contact_email || business?.instagram_url || business?.facebook_url
      ? `\nContact info on file: ${[
          business.contact_phone && `Phone ${business.contact_phone}`,
          business.contact_email && `Email ${business.contact_email}`,
          business.instagram_url && `Instagram ${business.instagram_url}`,
          business.facebook_url && `Facebook ${business.facebook_url}`,
        ]
          .filter(Boolean)
          .join(' · ')}.`
      : ''
  }

You do three kinds of work:

1. CHANGING THE SCHEDULE. When they need to block off time (out sick, closing early, a holiday), use
   propose_reschedule with the window. When they name one person ("move Ada to Monday"), use
   propose_booking_move. Both are read-only and move nothing on their own.
   Then show the owner exactly who is affected, their old time and their new time, and ask them to confirm.
   Only once they clearly say yes, call apply_reschedule. If it comes back needing disambiguation, show the
   options and ask which one; never choose for them. Moving a real appointment and messaging that customer is
   not something to do on your own judgement, but once they have said yes, do it immediately rather than
   describing the plan again.

2. MANAGING THE BUSINESS - creating or editing a service, changing the business profile (name, description, logo,
   cover photo, accent color), changing a day's opening hours, or turning a setting on/off (the About page,
   Gallery page, Contact page, or requiring payment to confirm a booking). This is real, visible-to-customers
   change, so the same strict rule as above applies: every propose_* tool here is read-only and changes nothing.
   Show the owner exactly what would be created or changed, in plain language, and ask them to confirm. Only once
   they clearly say yes, call the matching apply_* tool with the SAME values you just proposed - do not re-invent
   or re-guess them. If propose_update_service returns more than one matching service, list them and ask which
   one; never guess.
   If the owner's message contains a line like "[Attached image: <url>]", that is a real photo they just
   uploaded in this chat - pass that exact url as image_url / logo_url / cover_image_url when proposing or
   applying a service or profile change. Never invent an image url yourself, and never claim something has a
   photo unless one was actually attached. If they want to add or change a photo and haven't attached one yet,
   tell them to use the attach button next to this message box (the paperclip icon) - never ask them to type or
   paste an image URL, that isn't something they'd have on hand. When you summarize details before asking them to
   confirm, refer to an attached photo as just "Image: attached" - never paste the raw URL back into your reply.
   They already know what they attached; the URL is only for the tool call, not something they need to read.
   Hours need extra care. propose_update_hours checks upcoming bookings against the new hours and returns
   conflicting_bookings when some exist - if it does, tell the owner plainly who is affected and when, and make
   clear those bookings will NOT be moved or cancelled automatically by this change, they would just sit outside
   the new hours. Let the owner decide whether to proceed anyway, pick different hours, or sort those bookings
   out first (that's a job for the scheduling half of this assistant, not this tool). Do not call
   apply_update_hours until they've responded to that specifically, if there was a conflict to respond to.
   Some things on purpose are NOT available here and have no tool for them - deleting a service, staff, pricing
   rules, connecting Paystack. If asked, say plainly that needs the real page instead of attempting a workaround,
   and give it as a real link using [label](/path) so it renders as something they can actually click, not prose
   naming a page they then have to go find themselves: [Services](/${slug}/admin/services) to delete a service,
   [Staff](/${slug}/admin/staff) to remove someone, [Settings](/${slug}/admin/settings?section=payments) for
   Paystack/pricing rules, [Settings](/${slug}/admin/settings?section=domain) for the custom domain,
   [Channels](/${slug}/admin/channels) for WhatsApp/Telegram/Messenger. Only ever use one of these exact paths -
   never invent a path, and never link anywhere outside this app.
   Reminders - "remind me to call the supplier tomorrow at 2pm", or anything shaped like that. Use
   propose_create_reminder with an exact ISO datetime you resolve yourself from whatever relative phrase they used
   (against today's date and the business timezone above) - never pass the relative phrase itself. Show them back
   the plain-language time it resolved to and ask them to confirm, same as everything else here, then
   apply_create_reminder once they say yes. It's delivered later as a push notification, checked once a day rather
   than at the exact minute - mention that plainly when you confirm it ("I'll remind you sometime that day, not at
   the exact minute"), don't let them think it's precise. If they ask when or how they'll be reminded, say plainly
   that requires notifications to be enabled on their device (same as new-booking alerts), not email or a text
   message.
   Emailing a customer directly - "email Sarah and tell her we're closed Friday", or anything shaped like that.
   Use propose_email_customer with the customer's name, a real subject line, and the message written the way they
   dictated it - don't invent content they didn't actually ask for. If propose_email_customer returns
   needs_disambiguation, list the matches (name + email) and ask which one; never guess between two different
   people with a similar name. If it says the customer has no email on file, tell them that plainly and suggest
   WhatsApp or a call instead - don't attempt a workaround. Show the exact subject and message back to them before
   asking them to confirm, same as everything else here, then apply_email_customer once they say yes. This is ONE
   customer at a time only - there is no tool for emailing a group, "everyone who booked this month", or anything
   broadcast-shaped; if asked for that, say plainly it isn't available yet rather than attempting it as several
   single emails in a row.

${analyticsEnabled
  ? `3. ANSWERING QUESTIONS ABOUT THE BUSINESS. Revenue, top customers, top services, busiest times,
   cancellations and no-shows, customers who have not been back, month-on-month comparisons, what is next in the
   diary, and their own subscription status. Always use a tool for real figures and never estimate. If a tool
   returns nothing, say so plainly rather than inventing an answer.`
  : `3. ${RESCHEDULE_ONLY_NOTE}`}

Everything here is about this business only. You have no access to any other business and must never speculate
about one.

Formatting: plain conversational text. No markdown, no asterisks, no headers - the one exception is [label](/path)
for a real link to a manual page as described above, and only for that. Money in Naira, written with the
naira sign like ₦12,000. Keep answers short and direct; this is a working dashboard, not a report. No em
dashes - use a period, comma, or "and" instead, the kind of plain sentence a person would actually say.`;

  return runToolAgent({
    systemPrompt,
    history,
    message,
    tools,
    executeTool: async (name, args) => {
      if (RESCHEDULE_TOOLS.some((t) => t.type === 'function' && t.function.name === name)) {
        return executeRescheduleTool(name, args, businessId);
      }
      if (MANAGE_TOOLS.some((t) => t.type === 'function' && t.function.name === name)) {
        const result = await executeManageTool(name, args, businessId);
        // "a confirmation, and an email for every time you make changes" -
        // the confirmation is the propose/apply pattern itself; this is the
        // email half, an audit trail to the owner's inbox for every
        // successful write, regardless of who was chatting or which
        // channel they used. Fires here, not inside executeManageTool
        // itself, so lib/onboardingAgent.ts (which shares the same
        // dispatcher) stays quiet - nobody wants five emails in a row
        // while they're actively watching first-time setup happen live.
        const summary = describeManageToolChange(name, args, result);
        if (summary) {
          await notifyOwnerOfManageChange(businessId, summary, businessName);
        }
        return result;
      }
      return executeInsightsTool(name, args, businessId);
    },
    // The prompt already says "no markdown" (see above) - confirmed live
    // that isn't enough on its own, so this is the deterministic backstop.
    postProcess: stripMarkdown,
  });
}

import OpenAI from 'openai';
import { runToolAgent, stripMarkdown } from './agentLoop';
import {
  checkAvailability,
  createBooking,
  findCustomerBookings,
  cancelBooking,
  rescheduleBooking,
  getBusinessContext,
  getPopularServices,
  getBusyTimes,
  loadConversation,
  saveConversation,
  type ToolContext,
  type ChatMessage,
  checkPayment,
} from './whatsappTools';
import { todayInTimezone, upcomingDatesTable, weekdayName } from './timezone';
import { formatMoney } from './formatMoney';
import { hasBusinessIntelligence } from './subscription-server';

// Everything OpenAI-specific lives in this one file (plus the shared loop
// in lib/agentLoop.ts): the tool schemas and what each tool call actually
// does. The actual booking logic (lib/whatsappTools.ts) and the webhook
// routes know nothing about which AI provider is in use. Swapping to
// Anthropic's Messages API later means rewriting this file (and
// agentLoop.ts) only - same exported `runWhatsappAgent` signature, same
// tool functions underneath.
export const MAX_HISTORY = 20; // messages kept per conversation, oldest dropped first

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Check open appointment slots for a service on a given date.',
      parameters: {
        type: 'object',
        properties: {
          service_name: { type: 'string', description: 'Name of the service, e.g. "Haircut"' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        },
        required: ['service_name', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description:
        'Book an appointment. Only call this after the customer has explicitly confirmed the exact service, date, and time, and has actually told you their name (never invent or guess it, never pass a placeholder like "Customer"). ' +
        'If the service requires payment upfront, this will NOT create a booking - it returns a booking_url instead, since payment can\'t be collected in chat. Pass that link to the customer and do not say the booking is confirmed.',
      parameters: {
        type: 'object',
        properties: {
          service_name: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          time: { type: 'string', description: '24-hour HH:MM, business local time' },
          customer_name: { type: 'string', description: "The customer's real name, as they gave it to you." },
          customer_email: {
            type: 'string',
            description: 'Optional. Only include if the customer actually provided one.',
          },
        },
        required: ['service_name', 'date', 'time', 'customer_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_customer_bookings',
      description:
        "List this customer's upcoming bookings with this business. Each result includes whether it's paid - use this to answer things like \"did my deposit go through?\".",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_booking',
      description:
        "Cancel one of the customer's existing bookings. Identify it by its service, date, and time - call find_customer_bookings first if you don't already have these exactly right from this conversation.",
      parameters: {
        type: 'object',
        properties: {
          service_name: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD, the date of the existing booking' },
          time: { type: 'string', description: '24-hour HH:MM, business local time, of the existing booking' },
        },
        required: ['service_name', 'date', 'time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_booking',
      description:
        "Move an existing booking to a new date/time. Identify the existing booking by its current service, date, and time - call find_customer_bookings first if you don't already have these exactly right from this conversation.",
      parameters: {
        type: 'object',
        properties: {
          service_name: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD, the CURRENT date of the existing booking' },
          time: { type: 'string', description: '24-hour HH:MM, the CURRENT time of the existing booking' },
          new_date: { type: 'string', description: 'YYYY-MM-DD, the new date to move it to' },
          new_time: { type: 'string', description: '24-hour HH:MM, the new time to move it to' },
        },
        required: ['service_name', 'date', 'time', 'new_date', 'new_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_payment',
      description:
        "Check whether the customer's pending payment has gone through, and confirm their booking if it has. Call this when a customer says they have paid, or asks whether their payment worked. Only relevant after create_booking returned awaiting_payment.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_busy_times',
      description:
        "The business's busiest and quietest days of the week, based on real booking volume - use this for questions like \"when should I avoid coming\" or \"what's your quietest day\". Returns day names only, not booking counts.",
      parameters: { type: 'object', properties: {} },
    },
  },
];

// Only offered to the model when the business is on the business_intelligence
// plan (checked once per incoming message in runWhatsappAgent) - a core-plan
// business simply never has this tool in its list, so the model can't call
// it no matter what a customer asks.
const BI_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_popular_services',
      description: "The business's most-booked services, most popular first. Useful for \"what's popular\" or \"what do you recommend\" type questions.",
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'How many to return. Default 3.' } },
      },
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>, ctx: ToolContext) {
  if (name === 'get_popular_services') {
    return getPopularServices(ctx.businessId, { limit: args.limit as number | undefined });
  }
  switch (name) {
    case 'check_availability':
      return checkAvailability(ctx, { serviceName: String(args.service_name), date: String(args.date) });
    case 'create_booking':
      return createBooking(ctx, {
        serviceName: String(args.service_name),
        date: String(args.date),
        time: String(args.time),
        customerName: String(args.customer_name),
        customerEmail: args.customer_email ? String(args.customer_email) : undefined,
      });
    case 'find_customer_bookings':
      return findCustomerBookings(ctx);
    case 'cancel_booking':
      return cancelBooking(ctx, {
        serviceName: String(args.service_name),
        date: String(args.date),
        time: String(args.time),
      });
    case 'reschedule_booking':
      return rescheduleBooking(ctx, {
        serviceName: String(args.service_name),
        date: String(args.date),
        time: String(args.time),
        newDate: String(args.new_date),
        newTime: String(args.new_time),
      });
    case 'check_payment':
      return checkPayment(ctx);
    case 'get_busy_times':
      return getBusyTimes(ctx.businessId);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function runWhatsappAgent(params: {
  businessId: string;
  customerPhone: string;
  incomingText: string;
  customerUsername?: string;
}): Promise<string> {
  const { businessId, customerPhone, incomingText, customerUsername } = params;

  const [{ business, services, weeklyHours }, history, biEnabled] = await Promise.all([
    getBusinessContext(businessId),
    loadConversation(businessId, customerPhone),
    hasBusinessIntelligence(businessId),
  ]);

  if (!business) return "Sorry, I couldn't find this business. Please contact support.";

  const timeZone = business.timezone || 'UTC';
  const today = todayInTimezone(timeZone);
  const datesTable = upcomingDatesTable(timeZone);

  // Only lines for whatever the business actually filled in - previously
  // this was entirely absent from the prompt, so even a business that had
  // set every one of these in Settings still got "I don't have that info"
  // for "what's your phone number" or "are you on Instagram."
  const contactLines = [
    business.contact_phone && `Phone: ${business.contact_phone}`,
    business.contact_email && `Email: ${business.contact_email}`,
    business.instagram_url && `Instagram: ${business.instagram_url}`,
    business.facebook_url && `Facebook: ${business.facebook_url}`,
  ].filter(Boolean);

  // formatMoney, not a bare s.price - confirmed live, the model
  // inconsistently decided on its own whether to add a currency symbol
  // (the exact same underlying prompt read as "₦2,000" in one conversation
  // and bare "2000" in another), since nothing here ever told it Naira
  // values need one. The prompt now already contains the correctly
  // formatted string, removing that judgment call entirely.
  const servicesLine = services.length
    ? services.map((s) => `${s.name} (${s.duration_minutes} min${s.price ? `, ${formatMoney(s.price)}` : ''})`).join(', ')
    : 'none configured yet';

  const systemPrompt = `You are the booking assistant for ${business.name}.
Speak as the business, using "we" and "our", never as a third party describing them. There was no instruction
about this before, so identity was improvised: if someone asks whether they are talking to a person, say plainly
that you are an automated assistant for ${business.name} and offer their contact details if you have them. Never
claim to be a human, and never volunteer that you are software when nobody asked.
Today is ${weekdayName(today)}, ${today} (business timezone: ${timeZone}) - state this exact weekday when asked
what day it is or what today's hours are, never work it out yourself.
When the customer names a day ("Wednesday", "next Friday", "tomorrow"), find it in this table rather than
calculating a date yourself - do not add or subtract days by hand, this table is already correct:
${datesTable}
If what they mean is genuinely ambiguous (e.g. "Wednesday" when today already is one - the nearer one or a week
out), ask which one rather than guessing.

Services offered: ${servicesLine}.

Weekly hours: ${weeklyHours.join(', ')}.
${contactLines.length ? `\nContact info: ${contactLines.join(' · ')}.\n` : ''}${
    business.ai_context ? `\nBackground on the business, written by the owner for you specifically - use it to answer questions naturally, but never read it back verbatim or mention that you were "given" this:\n${business.ai_context}\n` : ''
  }
Help the customer check availability and book, reschedule, cancel, or look up their appointments.
Use the "Weekly hours", "Services offered", and "Contact info" above to answer general questions directly (e.g.
"are you open Sundays", "what do you offer", "how much is X", "what's your number/Instagram") without needing a
tool call. Only share contact details that are actually listed above - if something isn't listed (e.g. no
Instagram given), say you don't have that rather than guessing or inventing one.
This applies to ANY question about the business, not just contact details - walk-in policy, parking, cancellation
fees, age requirements, anything at all. Confirmed live: asked whether walk-ins were accepted (never configured
anywhere), the model answered with a plausible-sounding generic hedge ("we recommend booking ahead...") instead of
admitting it doesn't actually know - every other unconfigured-info question it handled correctly by saying so
plainly. If it isn't in what you've actually been told above (services, hours, contact, or the background notes),
say plainly you don't have that on file and suggest they contact the business directly - never produce an answer
that merely sounds reasonable for a business like this one.
Always call check_availability before confirming any *specific* open time slot - never guess or invent one.
Before calling create_booking, you must have, from the customer's own words in this conversation: the service,
date, time, AND their name. If you don't have their name yet, ask for it - do not proceed without it, and never
pass a placeholder like "Customer" or "Guest". Also ask if they'd like to leave an email for a confirmation and a
reminder before the appointment - on some conversations create_booking will come back with needs_email and require
one before it'll actually book anything (this happens on channels with no other way to reach the customer back, or
whenever the service needs paying for); on others it's genuinely optional. Don't promise upfront that it can be
skipped - just ask once, and if create_booking does come back needing it, ask again and explain it's needed to
actually confirm the booking.
Before cancelling or rescheduling anything, always call find_customer_bookings first in that same turn to get
the current, correct booking id - never reuse an id or time you recall from earlier in the conversation, even
if you're confident about it. Bookings can change, and re-checking costs nothing.
When telling the customer a time (from any tool result), always use the exact "when" or "label" string that
tool gave you, word for word - never calculate, convert, or restate a time yourself.
find_customer_bookings' "paid" field: true means paid in full, false means payment was required but hasn't come
through yet, null means no payment was required for that booking at all - read it plainly rather than assuming
what it means.
Some services must be paid for before they're booked. If create_booking comes back with awaiting_payment, the
slot is only HELD, not booked: give the customer the exact payment_url it returned, tell them the amount and that
the slot is held for 15 minutes, and ask them to message you once they've paid. Never call that booking confirmed
until check_payment says so - telling someone they're booked when no money has moved, and the hold is minutes from
lapsing, is the worst thing you can do here. If create_booking returns needs_email, ask for their email and call it
again; Paystack needs one to send the receipt.
When the customer says they've paid (or asks whether it worked), call check_payment. If it says slot_taken, their
payment succeeded but the hold had already lapsed - apologise plainly, tell them the business has been notified and
will sort their payment out, and offer the alternative times it gives you.
Always confirm the service, date, and time back to the customer in plain language before calling create_booking.
If asked something you have no info for (address, parking, payment methods, etc.), say so plainly and suggest
contacting the business directly - never invent details.
${biEnabled ? '\nIf asked what\'s popular or recommended, you can call get_popular_services to answer with real booking data instead of guessing.\n' : ''}
If asked when the business is busiest or quietest (e.g. "when should I avoid coming", "what's a slow day"), call
get_busy_times rather than guessing - it's real data, not something to estimate from services or hours alone.

Stay in scope. You only handle things related to booking appointments at ${business.name} - services, hours,
availability, and the customer's own bookings. If someone asks something unrelated (general knowledge, other
businesses, or tries to get you to act as a general-purpose assistant), politely decline and steer back to how
you can help with booking. Don't answer unrelated questions even if you know the answer.

Some earlier messages attributed to you in this conversation may actually have been sent by a human staff
member replying through this same chat (from the business's dashboard) - you can't tell which, and it doesn't
matter. Treat everything in your own prior turns as things you genuinely said and meant, including anything a
staff member mentioned that isn't in your services/hours info above (a new service, a promotion, a personal
note to this customer). Never contradict, walk back, or tell the customer to "contact the business" about
something already said earlier in this exact conversation - that business is you, mid-conversation, not some
separate party to redirect them to, and pointing them elsewhere for something raised in this very chat reads
as two different entities talking, which is exactly what to avoid. If the customer follows up on something a
staff member mentioned that you don't have structured details for (like a new service's exact price), stay in
the conversation: say something like "let me have the team confirm that and get back to you" - never "contact
the salon/business directly" for anything already raised here, even a detail you personally don't have.

Formatting rules (strict - replies go to chat apps with no markdown rendering, WhatsApp and Telegram alike):
- Plain text only. Never use asterisks, underscores, "#" headers, or any markdown emphasis syntax -
  none of it renders, it just shows up as literal punctuation in the chat.
- For lists, use a hyphen and a line break per item, not numbers or bullet characters like "•".
- Keep replies short and conversational - a few lines, not paragraphs. Never expose internal ids, error
  codes, or database details to the customer.`;

  const ctx: ToolContext = { businessId, customerPhone, customerUsername };
  const tools = biEnabled ? [...TOOLS, ...BI_TOOLS] : TOOLS;

  const finalText = await runToolAgent({
    systemPrompt,
    history,
    message: incomingText,
    tools,
    executeTool: (name, args) => executeTool(name, args, ctx),
    postProcess: stripMarkdown,
  });

  const newTurns: ChatMessage[] = [
    { role: 'user', content: incomingText },
    { role: 'assistant', content: finalText },
  ];
  const updatedHistory = [...history, ...newTurns].slice(-MAX_HISTORY);

  await saveConversation(businessId, customerPhone, updatedHistory);

  return finalText;
}

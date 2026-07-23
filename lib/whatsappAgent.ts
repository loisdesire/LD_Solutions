import OpenAI from 'openai';
import {
  checkAvailability,
  createBooking,
  findCustomerBookings,
  cancelBooking,
  rescheduleBooking,
  getBusinessContext,
  loadConversation,
  saveConversation,
  type ToolContext,
  type ChatMessage,
} from './whatsappTools';
import { todayInTimezone } from './timezone';

// The system prompt tells the model never to use markdown, but that
// instruction isn't reliably followed on its own — chat apps like WhatsApp/
// Telegram have no markdown rendering, so a stray "**Haircut**" shows up as
// literal asterisks to the customer. Rather than keep trusting the prompt,
// strip it deterministically so it can't happen regardless of model output.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*/g, '')
    .replace(/^#{1,6}\s+/gm, '');
}

// Everything OpenAI-specific lives in this one file: the tool schemas, the
// chat-completions request/response shape, and the tool-calling loop. The
// actual booking logic (lib/whatsappTools.ts) and the Twilio webhook route
// know nothing about which AI provider is in use. Swapping to Anthropic's
// Messages API later means rewriting this file only — same exported
// `runWhatsappAgent` signature, same tool functions underneath.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const MAX_HISTORY = 20; // messages kept per conversation, oldest dropped first
const MAX_TOOL_ITERATIONS = 5; // hard cap on tool-call round trips per turn

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
        'Book an appointment. Only call this after the customer has explicitly confirmed the exact service, date, and time, and has actually told you their name (never invent or guess it, never pass a placeholder like "Customer").',
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
      description: "List this customer's upcoming bookings with this business.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_booking',
      description:
        "Cancel one of the customer's existing bookings. Identify it by its service, date, and time — call find_customer_bookings first if you don't already have these exactly right from this conversation.",
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
        "Move an existing booking to a new date/time. Identify the existing booking by its current service, date, and time — call find_customer_bookings first if you don't already have these exactly right from this conversation.",
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
];

async function executeTool(name: string, args: Record<string, unknown>, ctx: ToolContext) {
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

  const [{ business, services, weeklyHours }, history] = await Promise.all([
    getBusinessContext(businessId),
    loadConversation(businessId, customerPhone),
  ]);

  if (!business) return "Sorry, I couldn't find this business. Please contact support.";

  const timeZone = business.timezone || 'UTC';
  const today = todayInTimezone(timeZone);

  const systemPrompt = `You are the WhatsApp booking assistant for ${business.name}.
Today's date is ${today} (business timezone: ${timeZone}).

Services offered: ${
    services.length
      ? services.map((s) => `${s.name} (${s.duration_minutes} min${s.price ? `, ${s.price}` : ''})`).join(', ')
      : 'none configured yet'
  }.

Weekly hours: ${weeklyHours.join(', ')}.

Help the customer check availability and book, reschedule, cancel, or look up their appointments.
Use the "Weekly hours" and "Services offered" info above to answer general questions directly (e.g.
"are you open Sundays", "what do you offer", "how much is X") without needing a tool call.
Always call check_availability before confirming any *specific* open time slot — never guess or invent one.
Before calling create_booking, you must have, from the customer's own words in this conversation: the service,
date, time, AND their name. If you don't have their name yet, ask for it — do not proceed without it, and never
pass a placeholder like "Customer" or "Guest". Also ask if they'd like to leave an email for a confirmation and a
reminder before the appointment; if they decline or don't answer, proceed without one, but always ask once.
Before cancelling or rescheduling anything, always call find_customer_bookings first in that same turn to get
the current, correct booking id — never reuse an id or time you recall from earlier in the conversation, even
if you're confident about it. Bookings can change, and re-checking costs nothing.
When telling the customer a time (from any tool result), always use the exact "when" or "label" string that
tool gave you, word for word — never calculate, convert, or restate a time yourself.
Always confirm the service, date, and time back to the customer in plain language before calling create_booking.
If asked something you have no info for (address, parking, payment methods, etc.), say so plainly and suggest
contacting the business directly — never invent details.

Stay in scope. You only handle things related to booking appointments at ${business.name} — services, hours,
availability, and the customer's own bookings. If someone asks something unrelated (general knowledge, other
businesses, or tries to get you to act as a general-purpose assistant), politely decline and steer back to how
you can help with booking. Don't answer unrelated questions even if you know the answer.

Some earlier messages attributed to you in this conversation may actually have been sent by a human staff
member replying through this same chat (from the business's dashboard) — you can't tell which, and it doesn't
matter. Treat everything in your own prior turns as things you genuinely said and meant, including anything a
staff member mentioned that isn't in your services/hours info above (a new service, a promotion, a personal
note to this customer). Never contradict, walk back, or tell the customer to "contact the business" about
something already said earlier in this exact conversation — that business is you, mid-conversation, not some
separate party to redirect them to, and pointing them elsewhere for something raised in this very chat reads
as two different entities talking, which is exactly what to avoid. If the customer follows up on something a
staff member mentioned that you don't have structured details for (like a new service's exact price), stay in
the conversation: say something like "let me have the team confirm that and get back to you" — never "contact
the salon/business directly" for anything already raised here, even a detail you personally don't have.

Formatting rules (strict — replies go to chat apps with no markdown rendering, WhatsApp and Telegram alike):
- Plain text only. Never use asterisks, underscores, "#" headers, or any markdown emphasis syntax —
  none of it renders, it just shows up as literal punctuation in the chat.
- For lists, use a hyphen and a line break per item, not numbers or bullet characters like "•".
- Keep replies short and conversational — a few lines, not paragraphs. Never expose internal ids, error
  codes, or database details to the customer.`;

  const conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({ role: m.role, content: m.content })),
    { role: 'user', content: incomingText },
  ];

  const ctx: ToolContext = { businessId, customerPhone, customerUsername };
  let finalText = 'Sorry, something went wrong on our end. Please try again in a moment.';

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: conversation,
      tools: TOOLS,
      tool_choice: 'auto',
    });

    const choice = completion.choices[0].message;
    conversation.push(choice);

    if (!choice.tool_calls || choice.tool_calls.length === 0) {
      finalText = choice.content ? stripMarkdown(choice.content) : finalText;
      break;
    }

    for (const toolCall of choice.tool_calls) {
      if (toolCall.type !== 'function') continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        args = {};
      }
      const result = await executeTool(toolCall.function.name, args, ctx);
      conversation.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  const newTurns: ChatMessage[] = [
    { role: 'user', content: incomingText },
    { role: 'assistant', content: finalText },
  ];
  const updatedHistory = [...history, ...newTurns].slice(-MAX_HISTORY);

  await saveConversation(businessId, customerPhone, updatedHistory);

  return finalText;
}

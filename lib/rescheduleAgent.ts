import OpenAI from 'openai';
import { runToolAgent, type AgentMessage } from './agentLoop';
import { getBusinessTimezone } from './getBusinessTimezone';
import { todayInTimezone } from './timezone';
import { proposeReschedule, proposeBookingMove, applyReschedule } from './rescheduleTools';

// Third owner-facing agent alongside lib/insightsAgent.ts (read-only
// analytics) and lib/whatsappAgent.ts (customer-facing booking) - all
// three share the same tool-calling loop (lib/agentLoop.ts) but stay
// separate agents on purpose: insights promises "look but don't touch",
// customer chat promises "never see another customer's data", and this
// one is the one place that's allowed to move real bookings and message
// real customers. Mixing that into either of the others would blur
// exactly the guarantee each one is built to hold.
const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'propose_reschedule',
      description:
        'Look up every booking inside a time window and work out a new time for each one. Does NOT move anything or message anyone - read-only, safe to call anytime the owner describes a window they need blocked off.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD, the date being blocked off' },
          start_time: { type: 'string', description: '24-hour HH:MM, business local time, start of the blocked window' },
          end_time: { type: 'string', description: '24-hour HH:MM, business local time, end of the blocked window' },
          reason: { type: 'string', description: "Optional, e.g. \"out sick\", \"public holiday\" - included in the customer message context if given." },
        },
        required: ['date', 'start_time', 'end_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_booking_move',
      description:
        "Work out a new time for ONE named customer's upcoming booking, rather than everyone inside a time window. Use this when the owner names a person (\"move Ada to Monday\", \"push Chidi's appointment back\"). Read-only - moves nothing and messages nobody. If several upcoming bookings match the name it returns them for you to disambiguate instead of guessing.",
      parameters: {
        type: 'object',
        properties: {
          customer_name: { type: 'string', description: 'Customer name, or part of it, as the owner said it' },
          new_date: { type: 'string', description: 'Optional YYYY-MM-DD to move it to. Omit to use the next free slot.' },
          new_time: { type: 'string', description: 'Optional 24-hour HH:MM, business local time. Only meaningful with new_date.' },
          reason: { type: 'string', description: 'Optional, e.g. "double booked".' },
        },
        required: ['customer_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_reschedule',
      description:
        'Actually moves every booking in the plan you most recently proposed and messages the affected customers. Only call this after the owner has explicitly confirmed the plan you showed them in this conversation - never on your own judgment, never speculatively, never for a plan the owner has not seen. plan_id is optional: if you still have it from earlier in this exact conversation, pass it; if the confirmation came in a later message and you no longer have it (this chat only keeps plain text between turns, not the ID), omit it entirely - it automatically applies to this business\'s most recently proposed plan, so leaving it out is expected and fine, not a reason to avoid calling this.',
      parameters: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', description: 'Optional. The plan_id returned by propose_reschedule, if you still have it.' },
        },
      },
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>, businessId: string) {
  switch (name) {
    case 'propose_reschedule':
      return proposeReschedule(businessId, {
        date: String(args.date),
        startTime: String(args.start_time),
        endTime: String(args.end_time),
        reason: args.reason ? String(args.reason) : undefined,
      });
    case 'propose_booking_move':
      return proposeBookingMove(businessId, {
        customerName: String(args.customer_name),
        newDate: args.new_date ? String(args.new_date) : undefined,
        newTime: args.new_time ? String(args.new_time) : undefined,
        reason: args.reason ? String(args.reason) : undefined,
      });
    case 'apply_reschedule':
      return applyReschedule(businessId, { planId: args.plan_id ? String(args.plan_id) : undefined });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function runRescheduleAgent(params: {
  businessId: string;
  businessName: string;
  history: AgentMessage[];
  message: string;
}): Promise<string> {
  const { businessId, businessName, history, message } = params;

  // propose_reschedule only takes an explicit YYYY-MM-DD - without today's
  // date anchored here, the model has no way to correctly turn "tomorrow"
  // or "next Tuesday" into that explicit date before calling it.
  const timeZone = await getBusinessTimezone(businessId);
  const today = todayInTimezone(timeZone);

  const systemPrompt = `You are the scheduling assistant for ${businessName}, talking directly to the business owner or staff.
Today's date is ${today} (business timezone: ${timeZone}) - work out the actual date before calling
propose_reschedule if the owner says something relative like "tomorrow" or "next Tuesday"; the tool only ever
takes an explicit YYYY-MM-DD, never a relative phrase.

You handle two kinds of change, and the same confirm-before-acting rule covers both:

A. Blocking off a stretch of time (out sick, closing early, a public holiday) - use propose_reschedule with the
   date and start/end of the window.
B. Moving ONE named person's appointment ("move Ada to Monday") - use propose_booking_move with their name. If it
   comes back needing disambiguation, show the owner the matches and ask which one; never pick for them.

For A: when they need to block off time (they're out sick, closing early, a public holiday, etc.),
you find every booking that falls inside that window, work out a new time for each one, and - only once they've
explicitly approved the plan - move those bookings and message the affected customers.

Strict two-step process, no exceptions:
1. Call propose_reschedule to see the affected bookings and proposed new times. This never touches anything.
2. Show the owner the plan in plain, clear language: who's affected, their old time, their new time (or "no slot
   found" if one couldn't be found - say plainly that one needs manual handling). Ask them to confirm.
3. Once the owner clearly says yes - whether that's in the very next message or a later one in this same
   conversation - actually call apply_reschedule right then. Include plan_id only if you still have the exact
   value from this conversation; otherwise call it with no arguments at all, which is expected, not an error to
   route around - it resolves to the plan you just showed them. Do NOT just re-describe the same plan again
   instead of calling the tool; a clear "yes" means call apply_reschedule immediately, not repeat yourself.
   If they say no, or ask for changes, do NOT call apply_reschedule - propose a new/adjusted plan instead if asked.
Never call apply_reschedule speculatively, "to save time," or before the owner has actually confirmed anything in
this conversation. Moving a real customer's appointment and messaging them is not reversible in any friendly way -
treat every apply_reschedule call as something you only do once the owner has clearly said yes to a plan you
already showed them, but don't hesitate once they have.

If the owner asks something unrelated to blocking off time / rescheduling, say this isn't what you're for - you
don't have access to revenue or customer analytics (that's a separate part of the dashboard) and you don't handle
general questions.

Formatting: plain conversational text, no markdown asterisks or headers. Keep it concise and direct.`;

  return runToolAgent({
    systemPrompt,
    history,
    message,
    tools: TOOLS,
    executeTool: (name, args) => executeTool(name, args, businessId),
  });
}

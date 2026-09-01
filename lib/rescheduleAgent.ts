import OpenAI from 'openai';
import { proposeReschedule, proposeBookingMove, applyReschedule } from './rescheduleTools';

// Tool set for moving real bookings and messaging real customers -
// consumed by the one unified owner-facing loop in assistantAgent.ts
// (runAssistantAgent) alongside lib/insightsAgent.ts's read-only
// analytics tools and lib/manageAgent.ts's settings tools, never by
// lib/whatsappAgent.ts's customer-facing loop. Kept on its own tool set
// rather than merged into customer chat's tools for the same reason
// insights is: mixing "this can move a real booking and message a real
// customer" into the loop that promises a customer "I'll never see
// another customer's data" would blur exactly the guarantee each side
// is built to hold.
//
// This file used to run its own standalone agent loop (runRescheduleAgent)
// before assistantAgent.ts consolidated insights/reschedule/manage tools
// into one owner-facing loop - removed as dead code (confirmed via
// ts-prune and a full-codebase grep: nothing imported it) rather than
// left as an unused second entry point into the same tools.
export const RESCHEDULE_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
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

export async function executeRescheduleTool(name: string, args: Record<string, unknown>, businessId: string) {
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

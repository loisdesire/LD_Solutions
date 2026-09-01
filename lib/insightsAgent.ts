import OpenAI from 'openai';
import {
  getRevenue,
  getTopCustomers,
  getTopServices,
  getNextAppointment,
  getBusinessSnapshot,
  getCancellationsAndNoShows,
  getBusiestTimes,
  findCustomer,
  getInactiveCustomers,
  compareRevenuePeriods,
  getBillingStatus,
} from './insightsTools';

// Read-only owner/staff data tools, consumed by the one unified owner-
// facing loop in assistantAgent.ts (runAssistantAgent), never by
// whatsappAgent.ts's customer-facing loop. Deliberately kept on a
// separate tool set rather than one shared with customer chat - mixing
// them would mean one system prompt and one set of reachable tools has
// to simultaneously promise a customer "I'll never share other people's
// information" and give a business owner exactly that; keeping the two
// structurally apart removes an entire class of prompt-injection/
// scope-confusion risk rather than relying on the model to always pick
// the right hat.
//
// This file used to run its own standalone agent loop (runInsightsAgent)
// before assistantAgent.ts consolidated insights/reschedule/manage tools
// into one owner-facing loop - removed as dead code (confirmed via
// ts-prune and a full-codebase grep: nothing imported it) rather than
// left as an unused second entry point into the same tools.
export const INSIGHTS_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_revenue',
      description: 'Total revenue from priced, non-cancelled bookings, optionally within a date range.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'ISO date/time to start from. Omit for all-time.' },
          to: { type: 'string', description: 'ISO date/time to end at. Omit for up to now.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_customers',
      description: 'The business\'s top customers by total spend, with visit count and last visit date.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'How many to return. Default 5.' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_services',
      description: 'The business\'s most-booked services, with booking count and revenue each has generated.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'How many to return. Default 5.' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_next_appointment',
      description: 'The single next upcoming appointment across the whole business.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_business_snapshot',
      description: 'Quick overview: total customers, total bookings all-time, bookings this month, revenue this month.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cancellations_and_no_shows',
      description:
        'Counts of cancelled and no-show bookings (and completed/confirmed, for context), optionally within a date range. Use this for anything about cancellations or no-shows - get_revenue and every other tool here excludes them entirely by design.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'ISO date/time to start from. Omit for all-time.' },
          to: { type: 'string', description: 'ISO date/time to end at. Omit for up to now.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_busiest_times',
      description: "The business's busiest day of the week and busiest hour of the day, from all-time booking data.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_customer',
      description:
        'Look up one specific customer by name or phone number - use this instead of get_top_customers when the owner asks about a particular person, since the top-customers list only covers the top few by spend.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: "The customer's name or phone number (or part of either)." } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_inactive_customers',
      description:
        'Customers who booked before but haven\'t in a while and have nothing upcoming - for "who am I at risk of losing" / "who hasn\'t come back" type questions.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'How many days since their last visit counts as inactive. Default 60.' },
          limit: { type: 'number', description: 'How many to return. Default 10.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_revenue_periods',
      description:
        'Revenue for a date range compared against the immediately preceding period of equal length, with the percent change already computed - use this for any "vs last month/week" type question instead of calling get_revenue twice and subtracting yourself.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Optional ISO date/time, start of the period. Omit for the current month.' },
          to: { type: 'string', description: 'Optional ISO date/time, end of the period. Omit for now.' },
        },
        // from/to are optional: omitted means this month vs last month, the
        // common case, handled inside the tool.

      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_billing_status',
      description: "This business's own subscription: current plan, trial/billing status, days left on trial, next billing date.",
      parameters: { type: 'object', properties: {} },
    },
  },
];

export async function executeInsightsTool(name: string, args: Record<string, unknown>, businessId: string) {
  switch (name) {
    case 'get_revenue':
      return getRevenue(businessId, { from: args.from as string | undefined, to: args.to as string | undefined });
    case 'get_top_customers':
      return getTopCustomers(businessId, { limit: args.limit as number | undefined });
    case 'get_top_services':
      return getTopServices(businessId, { limit: args.limit as number | undefined });
    case 'get_next_appointment':
      return getNextAppointment(businessId);
    case 'get_business_snapshot':
      return getBusinessSnapshot(businessId);
    case 'get_cancellations_and_no_shows':
      return getCancellationsAndNoShows(businessId, { from: args.from as string | undefined, to: args.to as string | undefined });
    case 'get_busiest_times':
      return getBusiestTimes(businessId);
    case 'find_customer':
      return findCustomer(businessId, { query: String(args.query) });
    case 'get_inactive_customers':
      return getInactiveCustomers(businessId, { days: args.days as number | undefined, limit: args.limit as number | undefined });
    case 'compare_revenue_periods':
      // Not String(args.from): String(undefined) is the literal "undefined",
      // which is truthy and would defeat the tool's own defaulting.
      return compareRevenuePeriods(businessId, {
        from: args.from ? String(args.from) : undefined,
        to: args.to ? String(args.to) : undefined,
      });
    case 'get_billing_status':
      return getBillingStatus(businessId);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

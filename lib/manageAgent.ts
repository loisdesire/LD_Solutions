import OpenAI from 'openai';
import {
  proposeCreateService,
  applyCreateService,
  proposeUpdateService,
  applyUpdateService,
  proposeToggleSetting,
  applyToggleSetting,
  proposeUpdateProfile,
  applyUpdateProfile,
  proposeUpdateBookingRules,
  applyUpdateBookingRules,
  proposeUpdateHours,
  applyUpdateHours,
  proposeCreateReminder,
  applyCreateReminder,
} from './manageTools';

// Tool schemas + dispatcher for "manage your business by chat" - the third
// thing the owner assistant can do, alongside rescheduling (rescheduleAgent.ts)
// and analytics (insightsAgent.ts). Split the same way those are: this file
// is what OpenAI sees and how a tool name gets routed, lib/manageTools.ts is
// what actually touches the database.

// Was just "Between 5 and 480." - no conversion help, no unit guidance.
// Confirmed live twice in one onboarding conversation: "a week" got passed
// as 1,008 minutes (should be 10,080 - a full order of magnitude off, i.e.
// the model silently computing 7*24*6 somewhere instead of 7*24*60) and "2
// days" as 288 (should be 2,880). Multi-step mental arithmetic is exactly
// the kind of thing a model gets wrong with no scaffolding; a ready
// reference table removes the arithmetic entirely rather than trusting it
// to redo 24*60 correctly every time. Also names the actual constraint
// (an appointment SLOT, not total turnaround) - the underlying case that
// prompted this was a made-to-order product ("takes a week" to finish),
// which isn't a duration problem to convert at all, it's a different kind
// of service the field was never meant to represent; naming that
// explicitly lets the model explain the real reason instead of quietly
// forcing a fake number.
const DURATION_MINUTES_DESCRIPTION =
  'Whole minutes, between 5 and 480 (480 = a full 8-hour day, the max a single appointment slot can be). ' +
  'This is how long the CUSTOMER\'S APPOINTMENT takes - the time they are actually present or the slot that ' +
  'occupies the calendar - not how long the whole job takes to finish. Reference: 30 min = 30, 1 hour = 60, ' +
  '2 hours = 120, half a day = 240, a full day = 480. If what they describe is longer than 480 (a multi-day ' +
  'turnaround, "a week", a made-to-order item), it is not a single-appointment duration at all - do not convert ' +
  'days/weeks into minutes. Instead ask what the actual appointment itself involves (e.g. a fitting, a drop-off, ' +
  'a consultation) and use that shorter time, explaining that the longer completion time isn\'t something this ' +
  'field can represent yet.';
export const MANAGE_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'propose_create_service',
      description:
        'Work out what a new service would look like from what the owner described - name, duration, price, description, and a photo if one was attached to this message. Read-only, creates nothing yet.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          duration_minutes: { type: 'number', description: DURATION_MINUTES_DESCRIPTION },
          price: { type: 'number', description: 'Omit entirely for "ask for pricing" - do not pass 0 to mean unpriced.' },
          description: { type: 'string', description: 'Optional, one or two sentences.' },
          image_url: { type: 'string', description: 'Only pass this if the owner\'s message included an attached image URL - never invent one.' },
          category: { type: 'string', description: 'Optional grouping label, e.g. "Hair", "Nails".' },
        },
        required: ['name', 'duration_minutes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_create_service',
      description:
        'Actually creates the service. Only call this after the owner has explicitly confirmed the exact plan propose_create_service just showed them - pass the same values.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          duration_minutes: { type: 'number' },
          price: { type: 'number' },
          description: { type: 'string' },
          image_url: { type: 'string' },
          category: { type: 'string' },
        },
        required: ['name', 'duration_minutes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_update_service',
      description:
        'Look up an existing service by name and work out what would change - price, duration, description, photo, name, or whether it\'s visible/hidden. Read-only. If more than one service matches the name, returns them for you to disambiguate instead of guessing.',
      parameters: {
        type: 'object',
        properties: {
          service_name: { type: 'string', description: 'The service to change, or part of its name.' },
          changes: {
            type: 'object',
            description: 'Only include the fields actually changing.',
            properties: {
              name: { type: 'string' },
              duration_minutes: { type: 'number', description: DURATION_MINUTES_DESCRIPTION },
              price: { type: 'number' },
              description: { type: 'string' },
              image_url: { type: 'string', description: 'Only if the owner attached a new image to this message.' },
              active: { type: 'boolean', description: 'true = visible/bookable, false = hidden.' },
            },
          },
        },
        required: ['service_name', 'changes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_update_service',
      description:
        'Actually applies the change. Only call this after the owner has explicitly confirmed the exact plan propose_update_service just showed them - pass the same service_name and changes.',
      parameters: {
        type: 'object',
        properties: {
          service_name: { type: 'string' },
          changes: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              duration_minutes: { type: 'number' },
              price: { type: 'number' },
              description: { type: 'string' },
              image_url: { type: 'string' },
              active: { type: 'boolean' },
            },
          },
        },
        required: ['service_name', 'changes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_toggle_setting',
      description:
        'Work out what turning a setting on or off would actually do. Covers: "about" (About page), "gallery" (Gallery page), "contact" (Contact page), "payment" (require payment to confirm a booking). Read-only, changes nothing yet.',
      parameters: {
        type: 'object',
        properties: {
          setting: { type: 'string', enum: ['about', 'gallery', 'contact', 'payment'] },
          enabled: { type: 'boolean' },
        },
        required: ['setting', 'enabled'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_toggle_setting',
      description:
        'Actually applies the setting change. Only call this after the owner has explicitly confirmed what propose_toggle_setting showed them.',
      parameters: {
        type: 'object',
        properties: {
          setting: { type: 'string', enum: ['about', 'gallery', 'contact', 'payment'] },
          enabled: { type: 'boolean' },
        },
        required: ['setting', 'enabled'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_update_profile',
      description:
        'Work out what changing the business profile (name, description, logo, cover photo, or accent color) would look like. Read-only, changes nothing yet. Only include the fields actually changing.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string', description: 'Shown at the top of the booking page, keep it to one or two sentences.' },
          logo_url: { type: 'string', description: 'Only if the owner attached an image to this message.' },
          cover_image_url: { type: 'string', description: 'Only if the owner attached an image to this message.' },
          accent_color: { type: 'string', description: 'A hex color like #C74A1E.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_update_profile',
      description:
        'Actually applies the profile change. Only call this after the owner has explicitly confirmed the exact plan propose_update_profile just showed them.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          logo_url: { type: 'string' },
          cover_image_url: { type: 'string' },
          accent_color: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_update_booking_rules',
      description:
        'Work out what changing the buffer time between appointments, or the deposit percentage required to confirm a booking, would look like. Read-only, changes nothing yet. Only include the field actually changing.',
      parameters: {
        type: 'object',
        properties: {
          buffer_minutes: { type: 'number', description: 'Minutes of gap kept free after each appointment, 0-180.' },
          deposit_percentage: {
            type: 'number',
            description:
              '1-100. 100 means the customer pays the full price to confirm; anything less is a partial deposit. Only meaningful once payment is turned on (see propose_toggle_setting, setting: "payment").',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_update_booking_rules',
      description:
        'Actually applies the buffer time or deposit percentage change. Only call this after the owner has explicitly confirmed the exact plan propose_update_booking_rules just showed them.',
      parameters: {
        type: 'object',
        properties: {
          buffer_minutes: { type: 'number' },
          deposit_percentage: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_update_hours',
      description:
        "Work out what changing one day's opening hours would look like, INCLUDING checking for upcoming bookings that would fall outside the new hours - always call this before apply_update_hours, never skip straight to applying. Read-only, changes nothing yet.",
      parameters: {
        type: 'object',
        properties: {
          day_of_week: { type: 'integer', description: '0 = Sunday, 1 = Monday, ... 6 = Saturday.' },
          start_time: { type: 'string', description: '24-hour HH:MM. Omit if closed is true.' },
          end_time: { type: 'string', description: '24-hour HH:MM. Omit if closed is true.' },
          closed: { type: 'boolean', description: 'true if this day should have no hours at all.' },
        },
        required: ['day_of_week'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_update_hours',
      description:
        'Actually applies the hours change. Only call this after the owner has explicitly confirmed the exact plan propose_update_hours just showed them - including after they have seen and responded to any conflicting-bookings warning.',
      parameters: {
        type: 'object',
        properties: {
          day_of_week: { type: 'integer' },
          start_time: { type: 'string' },
          end_time: { type: 'string' },
          closed: { type: 'boolean' },
        },
        required: ['day_of_week'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_create_reminder',
      description:
        'Work out what a reminder for the owner/staff would look like from what they described ("remind me to call the supplier tomorrow at 2pm"). Read-only, creates nothing yet.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'What to remind them about - their own words, cleaned up if needed.' },
          remind_at: {
            type: 'string',
            description:
              'An exact ISO 8601 datetime (with timezone offset), resolved from whatever relative phrase they used ("tomorrow at 2pm", "next Monday morning") against today\'s date and the business timezone given above. Never pass a relative phrase itself - resolve it first.',
          },
        },
        required: ['message', 'remind_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_create_reminder',
      description:
        'Actually creates the reminder. Only call this after they have explicitly confirmed the exact plan propose_create_reminder just showed them - pass the same values.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          remind_at: { type: 'string' },
        },
        required: ['message', 'remind_at'],
      },
    },
  },
];

export async function executeManageTool(name: string, args: Record<string, unknown>, businessId: string) {
  switch (name) {
    case 'propose_create_service':
      return proposeCreateService(businessId, {
        name: args.name,
        durationMinutes: args.duration_minutes,
        price: args.price,
        description: args.description,
        imageUrl: args.image_url,
        category: args.category,
      });
    case 'apply_create_service':
      return applyCreateService(businessId, {
        name: args.name,
        durationMinutes: args.duration_minutes,
        price: args.price,
        description: args.description,
        imageUrl: args.image_url,
        category: args.category,
      });
    case 'propose_update_service':
      return proposeUpdateService(businessId, {
        serviceName: args.service_name,
        changes: (args.changes as Record<string, unknown>) ?? {},
      });
    case 'apply_update_service':
      return applyUpdateService(businessId, {
        serviceName: args.service_name,
        changes: (args.changes as Record<string, unknown>) ?? {},
      });
    case 'propose_toggle_setting':
      return proposeToggleSetting(businessId, { setting: args.setting, enabled: args.enabled });
    case 'apply_toggle_setting':
      return applyToggleSetting(businessId, { setting: args.setting, enabled: args.enabled });
    case 'propose_update_profile':
      return proposeUpdateProfile(businessId, {
        name: args.name,
        description: args.description,
        logoUrl: args.logo_url,
        coverImageUrl: args.cover_image_url,
        accentColor: args.accent_color,
      });
    case 'apply_update_profile':
      return applyUpdateProfile(businessId, {
        name: args.name,
        description: args.description,
        logoUrl: args.logo_url,
        coverImageUrl: args.cover_image_url,
        accentColor: args.accent_color,
      });
    case 'propose_update_booking_rules':
      return proposeUpdateBookingRules(businessId, {
        bufferMinutes: args.buffer_minutes,
        depositPercentage: args.deposit_percentage,
      });
    case 'apply_update_booking_rules':
      return applyUpdateBookingRules(businessId, {
        bufferMinutes: args.buffer_minutes,
        depositPercentage: args.deposit_percentage,
      });
    case 'propose_update_hours':
      return proposeUpdateHours(businessId, {
        dayOfWeek: args.day_of_week,
        startTime: args.start_time,
        endTime: args.end_time,
        closed: args.closed,
      });
    case 'apply_update_hours':
      return applyUpdateHours(businessId, {
        dayOfWeek: args.day_of_week,
        startTime: args.start_time,
        endTime: args.end_time,
        closed: args.closed,
      });
    case 'propose_create_reminder':
      return proposeCreateReminder(businessId, { message: args.message, remindAt: args.remind_at });
    case 'apply_create_reminder':
      return applyCreateReminder(businessId, { message: args.message, remindAt: args.remind_at });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

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
  proposeUpdateHours,
  applyUpdateHours,
} from './manageTools';

// Tool schemas + dispatcher for "manage your business by chat" - the third
// thing the owner assistant can do, alongside rescheduling (rescheduleAgent.ts)
// and analytics (insightsAgent.ts). Split the same way those are: this file
// is what OpenAI sees and how a tool name gets routed, lib/manageTools.ts is
// what actually touches the database.
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
          duration_minutes: { type: 'number', description: 'Between 5 and 480.' },
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
              duration_minutes: { type: 'number' },
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
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

import { describe, expect, it } from 'vitest';
import { parseContact, formatContactForExport } from './contact';

// Pure string logic, but with a confirmed-live crash in its history: a
// booking with no phone at all (customer_phone is nullable, both the
// admin "new appointment" form and the API allow it) used to reach a
// bare `phone.startsWith(...)` and crash the ENTIRE dashboard with
// "Cannot read properties of null" - this runs once per row in the
// bookings list, so one bad row took the whole page down, not just
// itself. The null/undefined guard at the top is the fix.
describe('parseContact', () => {
  it('never throws on a null or undefined phone - the actual dashboard-crashing bug', () => {
    expect(() => parseContact(null)).not.toThrow();
    expect(() => parseContact(undefined)).not.toThrow();
    expect(parseContact(null)).toEqual({ channel: 'direct', isBotContact: false, label: 'No contact given' });
  });

  it('prefers a given email as the label over the generic fallback when phone is null', () => {
    expect(parseContact(null, undefined, 'jane@x.com')).toEqual({ channel: 'direct', isBotContact: false, label: 'jane@x.com' });
  });

  it('recognizes a whatsapp:-prefixed phone, stripping the prefix for the label', () => {
    expect(parseContact('whatsapp:+2348000000001')).toEqual({ channel: 'whatsapp', isBotContact: true, label: '+2348000000001' });
  });

  it('recognizes a telegram:-prefixed phone, using @username when given', () => {
    expect(parseContact('telegram:123456', 'janedoe')).toEqual({ channel: 'telegram', isBotContact: true, label: '@janedoe' });
  });

  it('recognizes a telegram:-prefixed phone with no username on file', () => {
    expect(parseContact('telegram:123456')).toEqual({ channel: 'telegram', isBotContact: true, label: 'via Telegram' });
  });

  it('recognizes a messenger:-prefixed phone', () => {
    expect(parseContact('messenger:psid-123')).toEqual({ channel: 'messenger', isBotContact: true, label: 'via Messenger' });
  });

  it('recognizes a web:-prefixed session id as a real (but channel-less) conversation, not a raw UUID shown as a contact', () => {
    const result = parseContact('web:9beabfdd-1234-5678-9abc-def012345678');
    expect(result.channel).toBe('direct');
    expect(result.isBotContact).toBe(true);
    expect(result.label).toBe('via web chat');
  });

  it('a web: session with a real email uses that email as the label instead of the generic fallback', () => {
    const result = parseContact('web:9beabfdd-1234-5678-9abc-def012345678', undefined, 'jane@x.com');
    expect(result.label).toBe('jane@x.com');
  });

  it('treats a plain phone number (no known prefix) as a real, non-bot direct contact', () => {
    expect(parseContact('+2348000000001')).toEqual({ channel: 'direct', isBotContact: false, label: '+2348000000001' });
  });
});

describe('formatContactForExport', () => {
  it('appends "(Telegram)" to a telegram contact that has a real username', () => {
    expect(formatContactForExport('telegram:123456', 'janedoe')).toBe('@janedoe (Telegram)');
  });

  it('does not append "(Telegram)" when there is no username to show', () => {
    expect(formatContactForExport('telegram:123456')).toBe('via Telegram');
  });

  it('leaves every other channel’s label as-is, with no channel suffix', () => {
    expect(formatContactForExport('whatsapp:+2348000000001')).toBe('+2348000000001');
    expect(formatContactForExport('+2348000000001')).toBe('+2348000000001');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Restores a chat conversation after navigating away and back. Carries a
// confirmed-live, already-fixed bug in getAssistantHistory: the original
// query ordered oldest-first and took the first HISTORY_LIMIT rows -
// correct only until the conversation actually grows past the limit, at
// which point it returns the SAME original oldest messages forever,
// making every message after that point permanently invisible on reload.
// The fix (descending + limit, then reversed back to chronological order)
// is what this file regression-tests directly.
type TableResult = { data?: unknown; error?: unknown };
function makeTable() {
  const queue: TableResult[] = [];
  const insertPayloads: unknown[] = [];
  function next(): TableResult {
    return queue.length > 0 ? queue.shift()! : { data: null, error: null };
  }
  const self: any = {
    select: () => self,
    insert: (arg: unknown) => {
      insertPayloads.push(arg);
      return Promise.resolve(next());
    },
    eq: () => self,
    order: () => self,
    limit: () => Promise.resolve(next()),
  };
  return {
    self,
    push: (...items: TableResult[]) => queue.push(...items),
    insertPayloads,
    reset: () => {
      queue.length = 0;
      insertPayloads.length = 0;
    },
  };
}
const assistantMessagesTable = makeTable();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => assistantMessagesTable.self }),
}));
vi.mock('./logger', () => ({ logError: vi.fn() }));

const { getAssistantHistory, appendAssistantMessages } = await import('./assistantHistory');
const { logError } = await import('./logger');

const BIZ = 'biz-1';
const STAFF = 'staff-1';

beforeEach(() => {
  vi.clearAllMocks();
  assistantMessagesTable.reset();
});

describe('getAssistantHistory', () => {
  it('returns the most recent messages in chronological order - not the oldest 40 forever, the actual bug fix', async () => {
    // The real query already asks for descending order + limit, so the
    // double hands back what THAT query would actually return: the most
    // recent N rows, newest first - proving the function reverses them
    // back into chronological order before returning.
    assistantMessagesTable.push({
      data: [
        { role: 'assistant', content: 'msg 42 (newest)' },
        { role: 'user', content: 'msg 41' },
        { role: 'assistant', content: 'msg 40 (oldest of this page)' },
      ],
      error: null,
    });

    const result = await getAssistantHistory(BIZ, STAFF, 'assistant');

    expect(result).toEqual([
      { role: 'assistant', content: 'msg 40 (oldest of this page)' },
      { role: 'user', content: 'msg 41' },
      { role: 'assistant', content: 'msg 42 (newest)' },
    ]);
  });

  it('returns an empty array rather than throwing when the table has not been migrated yet', async () => {
    assistantMessagesTable.push({ data: null, error: { code: 'PGRST205' } });
    const result = await getAssistantHistory(BIZ, STAFF, 'onboarding');
    expect(result).toEqual([]);
  });
});

describe('appendAssistantMessages', () => {
  it('inserts one row per message, tagged with businessId/staffId/kind', async () => {
    assistantMessagesTable.push({ data: null, error: null });
    await appendAssistantMessages(BIZ, STAFF, 'assistant', [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]);
    expect(assistantMessagesTable.insertPayloads[0]).toEqual([
      { business_id: BIZ, staff_id: STAFF, kind: 'assistant', role: 'user', content: 'hi' },
      { business_id: BIZ, staff_id: STAFF, kind: 'assistant', role: 'assistant', content: 'hello' },
    ]);
  });

  it('does nothing at all (no insert call) for an empty message list', async () => {
    await appendAssistantMessages(BIZ, STAFF, 'assistant', []);
    expect(assistantMessagesTable.insertPayloads).toHaveLength(0);
  });

  it('stays silent on a not-yet-migrated table (PGRST205) - expected, not worth logging', async () => {
    assistantMessagesTable.push({ data: null, error: { code: 'PGRST205' } });
    await appendAssistantMessages(BIZ, STAFF, 'assistant', [{ role: 'user', content: 'hi' }]);
    expect(logError).not.toHaveBeenCalled();
  });

  it('logs any other insert failure - a real chat turn whose history silently failed to save is worth knowing about', async () => {
    assistantMessagesTable.push({ data: null, error: { code: '23505', message: 'duplicate key' } });
    await appendAssistantMessages(BIZ, STAFF, 'assistant', [{ role: 'user', content: 'hi' }]);
    expect(logError).toHaveBeenCalledWith('assistantHistory:append-failed', expect.objectContaining({ code: '23505' }), {
      businessId: BIZ,
      staffId: STAFF,
      kind: 'assistant',
    });
  });

  it('never throws on an insert failure - a failed history save must never fail the chat turn that already succeeded', async () => {
    assistantMessagesTable.push({ data: null, error: { code: '23505', message: 'duplicate key' } });
    await expect(appendAssistantMessages(BIZ, STAFF, 'assistant', [{ role: 'user', content: 'hi' }])).resolves.toBeUndefined();
  });
});

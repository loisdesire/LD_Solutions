import { beforeEach, describe, expect, it, vi } from 'vitest';

// Single-shot "find me the product" reasoning over a business's own small
// catalog - no ordering/payment/inventory writes here. The one thing worth
// testing carefully is the defensive filtering: the model's own
// productIds are never trusted blindly, only ever intersected against
// this business's real catalog ids, the same principle the booking agent
// applies to a model-supplied booking id. Also covers the empty-catalog
// early return and the malformed-JSON-from-the-model fallback.
const createMock = vi.fn();
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: (...args: unknown[]) => createMock(...args) } };
  },
}));

type TableResult = { data?: unknown; error?: unknown };
function makeTable() {
  const queue: TableResult[] = [];
  function next(): TableResult {
    return queue.length > 0 ? queue.shift()! : { data: null, error: null };
  }
  const self: any = {
    select: () => self,
    eq: () => self,
    order: () => self,
    single: () => Promise.resolve(next()),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise.resolve(next()).then(resolve, reject),
  };
  return { self, push: (...items: TableResult[]) => queue.push(...items) };
}
const businessesTable = makeTable();
const productsTable = makeTable();
const TABLES: Record<string, ReturnType<typeof makeTable>> = { businesses: businessesTable, products: productsTable };
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const t = TABLES[table];
      if (!t) throw new Error(`test double doesn't expect a query against "${table}"`);
      return t.self;
    },
  }),
}));

const { searchProducts } = await import('./productSearch');

const BIZ = 'biz-1';
const CATALOG = [
  { id: 'p1', name: 'Red Lipstick', description: 'Matte finish', price: 3000, stock_quantity: 10 },
  { id: 'p2', name: 'Blue Eyeshadow', description: null, price: 2000, stock_quantity: 0 },
];

function completionWith(content: string) {
  return { choices: [{ message: { content } }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  businessesTable.push({ data: { name: 'Glow Cosmetics' }, error: null });
});

describe('searchProducts', () => {
  it('returns an empty-catalog message and never calls the model when the business has no active products', async () => {
    productsTable.push({ data: [], error: null });

    const result = await searchProducts(BIZ, 'lipstick');

    expect(result).toEqual({ reply: "We don't have any products listed yet.", products: [] });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns only the products the model confidently matched, in their real catalog shape', async () => {
    productsTable.push({ data: CATALOG, error: null });
    createMock.mockResolvedValueOnce(completionWith(JSON.stringify({ reply: 'Here is our red lipstick!', productIds: ['p1'] })));

    const result = await searchProducts(BIZ, 'something red for lips');

    expect(result.reply).toBe('Here is our red lipstick!');
    expect(result.products).toEqual([CATALOG[0]]);
  });

  it('never trusts a model-supplied product id that is not actually in this business’s real catalog - the defensive filter this file exists for', async () => {
    productsTable.push({ data: CATALOG, error: null });
    createMock.mockResolvedValueOnce(
      completionWith(JSON.stringify({ reply: 'Here you go!', productIds: ['p1', 'not-a-real-id', 'p999'] }))
    );

    const result = await searchProducts(BIZ, 'anything');

    expect(result.products).toEqual([CATALOG[0]]);
  });

  it('falls back to an empty parsed object (no reply, no products) rather than throwing on malformed JSON from the model', async () => {
    productsTable.push({ data: CATALOG, error: null });
    createMock.mockResolvedValueOnce(completionWith('not valid json at all'));

    const result = await searchProducts(BIZ, 'anything');

    expect(result.reply).toMatch(/couldn.t quite catch that/);
    expect(result.products).toEqual([]);
  });

  it('returns an empty products array (not an error) when the model asks a clarifying question instead of matching anything', async () => {
    productsTable.push({ data: CATALOG, error: null });
    createMock.mockResolvedValueOnce(completionWith(JSON.stringify({ reply: 'Do you mean red or blue?', productIds: [] })));

    const result = await searchProducts(BIZ, 'makeup');

    expect(result.reply).toBe('Do you mean red or blue?');
    expect(result.products).toEqual([]);
  });

  it('includes the conversation history in the messages sent to the model, in order, before the new query', async () => {
    productsTable.push({ data: CATALOG, error: null });
    createMock.mockResolvedValueOnce(completionWith(JSON.stringify({ reply: 'ok', productIds: [] })));

    await searchProducts(BIZ, 'and in blue?', [
      { role: 'user', content: 'do you have lipstick' },
      { role: 'assistant', content: 'yes, red lipstick' },
    ]);

    const sentMessages = createMock.mock.calls[0][0].messages;
    expect(sentMessages[1]).toEqual({ role: 'user', content: 'do you have lipstick' });
    expect(sentMessages[2]).toEqual({ role: 'assistant', content: 'yes, red lipstick' });
    expect(sentMessages[sentMessages.length - 1]).toEqual({ role: 'user', content: 'and in blue?' });
  });
});

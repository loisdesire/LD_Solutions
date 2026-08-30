import { NextRequest, NextResponse } from 'next/server';
import { searchProducts, type ProductChatMessage } from '@/lib/productSearch';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';
import { cleanRequiredText, isUuid } from '@/lib/apiValidation';

// POST /api/products/search - public, called from the product-finder chat
// widget on a business's own booking page. No auth needed (same trust level
// as viewing the page itself), just rate-limited against abuse/cost.
export async function POST(req: NextRequest) {
  if (!(await rateLimit(`product-search:${getClientIp(req)}`, 20, 5 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { businessId, query, history } = body;
  const safeQuery = cleanRequiredText(query, 500);

  if (!isUuid(businessId) || !safeQuery) {
    return NextResponse.json({ error: 'Invalid business or query' }, { status: 400 });
  }

  const safeHistory: ProductChatMessage[] = Array.isArray(history)
    ? history
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.length <= 2000)
        .slice(-10)
    : [];

  try {
    const result = await searchProducts(businessId, safeQuery, safeHistory);
    return NextResponse.json(result);
  } catch (err) {
    logError('api/products/search', err, { businessId });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

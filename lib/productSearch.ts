import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Discovery only, deliberately — no ordering, no payment, no inventory
// writes here. This is a single-shot reasoning call over the business's own
// catalog (given directly in context, since these are small-catalog small
// businesses), not an agentic tool-calling loop like lib/whatsappAgent.ts —
// there's nothing for the model to *do* here, only something to figure out.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type ProductChatMessage = { role: 'user' | 'assistant'; content: string };

export type MatchedProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  stock_quantity: number | null;
};

export async function searchProducts(businessId: string, query: string, history: ProductChatMessage[] = []) {
  const [{ data: business }, { data: products }] = await Promise.all([
    supabaseAdmin.from('businesses').select('name').eq('id', businessId).single(),
    supabaseAdmin
      .from('products')
      .select('id, name, description, price, stock_quantity')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('name'),
  ]);

  if (!products || products.length === 0) {
    return { reply: "We don't have any products listed yet.", products: [] as MatchedProduct[] };
  }

  const catalogText = products
    .map(
      (p) =>
        `- id: ${p.id} | name: ${p.name} | description: ${p.description ?? 'none'} | price: ${p.price ?? 'n/a'} | stock: ${p.stock_quantity ?? 'n/a'}`
    )
    .join('\n');

  const systemPrompt = `You are a product-finding assistant for ${business?.name ?? 'this shop'}.
Here is the full product catalog:
${catalogText}

The customer will describe what they're looking for in their own words — they might not know the exact
product name, might describe color, use-case, or vibe instead, or might just be vague. Your job is to figure
out which real product(s) from the catalog above they mean, the way a good shop assistant would.

Rules:
- Only ever refer to products that are actually in the catalog above. Never invent a product or a detail
  about one that isn't listed.
- If you're confident which product(s) match, say so conversationally and list them.
- If genuinely ambiguous between two or more real candidates, ask a short clarifying question instead of
  guessing which one they mean.
- If nothing in the catalog matches at all, say so honestly rather than forcing a match.
- You can only help the customer find and learn about products — you cannot place an order, take payment, or
  check someone out. If asked how to buy/order/pay, say plainly that you can't process orders yet and they
  should contact ${business?.name ?? 'the business'} directly to complete a purchase. Never claim there's a
  website, cart, or checkout to order through — none exists. Don't invent a phone number or contact method
  either; just say "contact them directly" unless you were actually given contact info above.
- Keep replies short and friendly, a sentence or two.

Respond with ONLY a JSON object of this exact shape, no other text before or after it:
{"reply": "your conversational reply text", "productIds": ["id1", "id2"]}
productIds should contain the ids of products you are confidently presenting to the customer right now — leave
it empty if you're asking a clarifying question or nothing matches.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({ role: m.role, content: m.content })),
    { role: 'user', content: query },
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0].message.content ?? '{}';
  let parsed: { reply?: string; productIds?: string[] } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  // Never trust model-supplied ids blindly — filter to what's actually in
  // this business's real catalog, same defensive principle as the booking
  // agent never trusting a model-supplied booking id.
  const catalogIds = new Set(products.map((p) => p.id));
  const matchedIds = (parsed.productIds ?? []).filter((id) => catalogIds.has(id));
  const matchedProducts = products.filter((p) => matchedIds.includes(p.id));

  return {
    reply: parsed.reply ?? "Sorry, I couldn't quite catch that — could you try describing it differently?",
    products: matchedProducts,
  };
}

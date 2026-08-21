// Server-only. Each business connects their own Paystack account (same
// self-serve pattern as Telegram/WhatsApp — they paste their own keys in
// Settings), so this verifies against that business's own secret key.
// Money settles straight to their Paystack account; nothing here ever
// touches or moves funds, it only confirms a payment already happened
// before a booking is allowed to go through.
export async function verifyPaystackTransaction(
  secretKey: string,
  reference: string
): Promise<{ status: string; amount: number; currency: string } | null> {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  }).catch(() => null);

  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data?.status || !data.data) return null;

  // Paystack amounts are in kobo (₦1 = 100 kobo) — callers compare this
  // against their own expected-kobo figure, not a naira one.
  return { status: data.data.status, amount: data.data.amount, currency: data.data.currency };
}

// Creates a hosted checkout the customer can open from a chat message.
// Unlike the web booking flow (which uses Paystack Inline, a popup inside
// a page we control), a chat has nowhere to host a popup — so the payment
// happens on Paystack's own page and comes back to us asynchronously.
//
// `reference` is ours, not Paystack's, so the booking it belongs to is
// knowable before any money moves; metadata carries the booking id so the
// webhook can find its way back to the right row.
export async function initializePaystackTransaction(params: {
  secretKey: string;
  email: string;
  amountKobo: number;
  reference: string;
  bookingId: string;
  callbackUrl?: string;
}): Promise<{ authorizationUrl: string; reference: string } | null> {
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: { booking_id: params.bookingId },
    }),
  }).catch(() => null);

  if (!res) return null;
  const data = await res.json().catch(() => null);
  if (!data?.status || !data.data?.authorization_url) return null;

  return { authorizationUrl: data.data.authorization_url, reference: data.data.reference };
}

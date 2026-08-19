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

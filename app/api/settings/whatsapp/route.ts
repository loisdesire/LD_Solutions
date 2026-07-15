import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase-server';
import { getBusinessBySlug } from '@/lib/getBusinessBySlug';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { logError } from '@/lib/logger';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function authorize(slug: string) {
  const data = await getBusinessBySlug(slug);
  if (!data) return { error: NextResponse.json({ error: 'Business not found' }, { status: 404 }) };

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };

  const { data: staffRow } = await supabase
    .from('staff')
    .select('id')
    .eq('business_id', data.business.id)
    .eq('auth_id', user.id)
    .maybeSingle();
  if (!staffRow) return { error: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) };

  return { business: data.business };
}

// POST /api/settings/whatsapp — unlike Telegram, there's no API call that
// can register a webhook for an arbitrary WhatsApp number on the business's
// own Twilio account (that requires their console access, which we don't
// have). This just validates and saves the number; the UI shows the exact
// webhook URL for them to paste into their Twilio console themselves.
export async function POST(req: NextRequest) {
  if (!rateLimit(`settings-whatsapp:${getClientIp(req)}`, 10, 5 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  const { slug, whatsappNumber } = await req.json();
  if (!slug || typeof whatsappNumber !== 'string') {
    return NextResponse.json({ error: 'Missing slug or WhatsApp number' }, { status: 400 });
  }

  const number = whatsappNumber.trim();
  if (!/^whatsapp:\+[1-9]\d{6,14}$/.test(number)) {
    return NextResponse.json(
      { error: 'Enter it as whatsapp:+<countrycode><number>, e.g. whatsapp:+2348012345678' },
      { status: 400 }
    );
  }

  const auth = await authorize(slug);
  if (auth.error) return auth.error;
  const { business } = auth;

  const { error: updateError } = await supabaseAdmin
    .from('businesses')
    .update({ whatsapp_number: number })
    .eq('id', business.id);

  if (updateError) {
    logError('api/settings/whatsapp:save', updateError, { businessId: business.id });
    if ((updateError as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'This number is already connected to another business.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to save. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}

export async function DELETE(req: NextRequest) {
  const { slug } = await req.json();
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const auth = await authorize(slug);
  if (auth.error) return auth.error;
  const { business } = auth;

  await supabaseAdmin.from('businesses').update({ whatsapp_number: null }).eq('id', business.id);
  return NextResponse.json({ disconnected: true });
}

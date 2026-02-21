import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getTenantId } from '../../../../lib/supabase';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabase();
  const onboardToken = randomUUID();

  const { data, error } = await supabase
    .from('waitlist_leads')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      onboard_token: onboardToken,
    })
    .eq('id', params.id)
    .eq('status', 'pending')
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Lead not found or already processed' }, { status: 404 });
  }

  return NextResponse.json({
    lead: data,
    onboardLink: `https://emilybot.com.br/onboard?token=${onboardToken}`,
  });
}

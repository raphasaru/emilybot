import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getTenantId } from '../../../../lib/supabase';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabase();
  const { error } = await supabase
    .from('waitlist_leads')
    .update({ status: 'rejected' })
    .eq('id', params.id)
    .eq('status', 'pending');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

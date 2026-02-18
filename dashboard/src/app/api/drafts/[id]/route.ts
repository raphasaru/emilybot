import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { final_content } = await req.json();
  const supabase = getSupabase();
  const { error } = await supabase
    .from('content_drafts')
    .update({ final_content, updated_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

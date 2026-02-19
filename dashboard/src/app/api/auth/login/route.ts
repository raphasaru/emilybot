import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { signCookie } from '../../../lib/auth';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function POST(req: NextRequest) {
  const { name, password } = await req.json();
  if (!name || !password) {
    return NextResponse.json({ error: 'Nome e senha obrigatórios' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, dashboard_password_hash')
    .ilike('name', name.trim())
    .eq('active', true)
    .single();

  if (error || !tenant || !tenant.dashboard_password_hash) {
    return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 401 });
  }

  if (tenant.dashboard_password_hash !== hashPassword(password)) {
    return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('dash_auth', await signCookie(tenant.id), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

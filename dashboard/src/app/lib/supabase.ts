import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyCookie } from './auth';

export function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function getTenantId(): Promise<string | null> {
  const cookie = cookies().get('dash_auth')?.value;
  if (!cookie) return null;
  return verifyCookie(cookie);
}

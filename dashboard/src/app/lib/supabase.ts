import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

export function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export function getTenantId(): string {
  return headers().get('x-tenant-id')!;
}

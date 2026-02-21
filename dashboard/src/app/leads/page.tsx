import { redirect } from 'next/navigation';
import { getSupabase, getTenantId } from '../lib/supabase';
import LeadsList from './LeadsList';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const tenantId = await getTenantId();
  if (!tenantId) redirect('/login');

  const supabase = getSupabase();
  const { data: leads, error } = await supabase
    .from('waitlist_leads')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    return <div className="p-8 text-red-400">Erro ao buscar leads: {error.message}</div>;
  }

  return <LeadsList initialLeads={leads || []} />;
}

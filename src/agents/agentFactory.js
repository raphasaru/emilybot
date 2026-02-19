'use strict';

const { supabase } = require('../database/supabase');

async function createAgent({ name, display_name, role, system_prompt, position_in_flow = null, tenant_id }) {
  const payload = { name, display_name, role, system_prompt, position_in_flow, is_active: true };
  if (tenant_id) payload.tenant_id = tenant_id;

  const { data, error } = await supabase
    .from('agents')
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function deactivateAgent(id) {
  const { error } = await supabase
    .from('agents')
    .update({ is_active: false, position_in_flow: null })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

async function getNextPosition(tenantId) {
  let query = supabase
    .from('agents')
    .select('position_in_flow')
    .not('position_in_flow', 'is', null);

  if (tenantId) query = query.eq('tenant_id', tenantId);

  query = query.order('position_in_flow', { ascending: false }).limit(1).single();

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data ? data.position_in_flow + 1 : 1;
}

module.exports = { createAgent, deactivateAgent, getNextPosition };

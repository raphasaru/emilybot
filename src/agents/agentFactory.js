'use strict';

const { supabase } = require('../database/supabase');

async function createAgent({ name, display_name, role, system_prompt, position_in_flow = null }) {
  const { data, error } = await supabase
    .from('agents')
    .insert({ name, display_name, role, system_prompt, position_in_flow, is_active: true })
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

async function getNextPosition() {
  const { data, error } = await supabase
    .from('agents')
    .select('position_in_flow')
    .not('position_in_flow', 'is', null)
    .order('position_in_flow', { ascending: false })
    .limit(1)
    .single();

  if (error) throw new Error(error.message);
  return data ? data.position_in_flow + 1 : 1;
}

module.exports = { createAgent, deactivateAgent, getNextPosition };

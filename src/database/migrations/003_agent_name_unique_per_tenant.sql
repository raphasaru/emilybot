-- Drop global unique constraint on agents.name
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_name_key;

-- Add composite unique constraint (name, tenant_id)
ALTER TABLE agents ADD CONSTRAINT agents_name_tenant_unique UNIQUE (name, tenant_id);

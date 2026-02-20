-- Add encrypted Apify API key to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS apify_key TEXT;

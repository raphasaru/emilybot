-- 007_waitlist.sql — waitlist_leads & invite_codes for early access system

-- waitlist_leads
CREATE TABLE IF NOT EXISTS waitlist_leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text UNIQUE NOT NULL,
  instagram     text,
  status        text DEFAULT 'pending',
  priority      boolean DEFAULT false,
  invite_code   text,
  created_at    timestamptz DEFAULT now(),
  approved_at   timestamptz,
  onboard_token text UNIQUE
);

-- invite_codes
CREATE TABLE IF NOT EXISTS invite_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  code          text UNIQUE NOT NULL,
  used_by       uuid REFERENCES waitlist_leads(id),
  created_at    timestamptz DEFAULT now(),
  used_at       timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist_leads(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_priority ON waitlist_leads(priority);
CREATE INDEX IF NOT EXISTS idx_waitlist_token ON waitlist_leads(onboard_token);
CREATE INDEX IF NOT EXISTS idx_invite_codes_tenant ON invite_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);

-- RLS
ALTER TABLE waitlist_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- anon can INSERT (signup form) and SELECT (duplicate check) on waitlist_leads
CREATE POLICY "anon_insert_waitlist" ON waitlist_leads
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_waitlist" ON waitlist_leads
  FOR SELECT TO anon USING (true);

-- anon can SELECT invite_codes by code (referral validation)
CREATE POLICY "anon_select_invite_codes" ON invite_codes
  FOR SELECT TO anon USING (true);

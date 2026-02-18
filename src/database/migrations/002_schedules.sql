CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  format TEXT DEFAULT 'post_unico',
  is_active BOOLEAN DEFAULT true,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

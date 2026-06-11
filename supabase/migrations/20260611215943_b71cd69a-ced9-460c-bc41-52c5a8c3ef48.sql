ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS bank_code        TEXT,
  ADD COLUMN IF NOT EXISTS bank_agency      TEXT,
  ADD COLUMN IF NOT EXISTS bank_account     TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_dv  TEXT,
  ADD COLUMN IF NOT EXISTS account_type     TEXT DEFAULT 'checking',
  ADD COLUMN IF NOT EXISTS legal_name       TEXT,
  ADD COLUMN IF NOT EXISTS holder_name      TEXT,
  ADD COLUMN IF NOT EXISTS holder_document  TEXT,
  ADD COLUMN IF NOT EXISTS recipient_status TEXT DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS recipient_error  TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_recipient_status
  ON public.tenants(recipient_status)
  WHERE deleted_at IS NULL;
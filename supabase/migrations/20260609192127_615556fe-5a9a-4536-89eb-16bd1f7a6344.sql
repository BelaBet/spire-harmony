ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS gateway_request jsonb,
  ADD COLUMN IF NOT EXISTS gateway_response jsonb,
  ADD COLUMN IF NOT EXISTS error_message text;
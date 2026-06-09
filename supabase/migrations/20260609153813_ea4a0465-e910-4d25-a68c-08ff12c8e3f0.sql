
CREATE TABLE public.tenant_payment_info_cache (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.tenant_payment_info_cache TO service_role;

ALTER TABLE public.tenant_payment_info_cache ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role (server-side admin client) reads/writes this cache.

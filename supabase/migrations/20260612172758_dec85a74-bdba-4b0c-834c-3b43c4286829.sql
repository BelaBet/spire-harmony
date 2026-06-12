
-- 1) cost_centers: remove staff SELECT (staff usa view cost_centers_public)
DROP POLICY IF EXISTS cost_centers_select_staff ON public.cost_centers;

-- 2) donations: bloqueia INSERT pelo PostgREST e restringe SELECT
DROP POLICY IF EXISTS donations_insert_self ON public.donations;
DROP POLICY IF EXISTS donations_select ON public.donations;

CREATE POLICY donations_select_own_or_admin
  ON public.donations
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (profile_id = auth.uid() OR public.is_platform_admin(auth.uid()))
  );

CREATE OR REPLACE VIEW public.donations_staff AS
SELECT
  id, tenant_id, profile_id, amount, payment_id, created_at,
  cost_center_id, campaign_id, installments, payment_method,
  gross_amount, net_amount, admin_fee, receipt_url
FROM public.donations
WHERE deleted_at IS NULL
  AND (
    public.is_tenant_staff(auth.uid(), tenant_id)
    OR public.is_platform_admin(auth.uid())
  );

GRANT SELECT ON public.donations_staff TO authenticated;

-- 3) payments: restringe SELECT e cria view sem dados financeiros sensíveis
DROP POLICY IF EXISTS payments_select ON public.payments;

CREATE POLICY payments_select_own_or_admin
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (profile_id = auth.uid() OR public.is_platform_admin(auth.uid()))
  );

CREATE OR REPLACE VIEW public.payments_staff AS
SELECT
  id, tenant_id, profile_id, amount, method, status,
  reference_type, reference_id, gateway_id, created_at,
  donation_amount, cost_center_id, card_brand
FROM public.payments
WHERE deleted_at IS NULL
  AND (
    public.is_tenant_staff(auth.uid(), tenant_id)
    OR public.is_platform_admin(auth.uid())
  );

GRANT SELECT ON public.payments_staff TO authenticated;

-- 4) tenants: restringe SELECT a platform admin e cria view segura
DROP POLICY IF EXISTS tenants_staff_select ON public.tenants;

CREATE POLICY tenants_platform_admin_select
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE OR REPLACE VIEW public.tenants_staff AS
SELECT
  id, name, slug, logo_url, primary_color, secondary_color, accent_color,
  custom_domain, active, created_at, tagline, cover_photo_url,
  recipient_status, recipient_error
FROM public.tenants
WHERE deleted_at IS NULL
  AND (
    public.is_tenant_staff(auth.uid(), id)
    OR public.is_platform_admin(auth.uid())
  );

GRANT SELECT ON public.tenants_staff TO authenticated;

-- 5) tenant_payment_info_cache: garante que não há acesso pelo PostgREST
REVOKE ALL ON public.tenant_payment_info_cache FROM anon, authenticated;
GRANT ALL ON public.tenant_payment_info_cache TO service_role;

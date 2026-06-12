
-- Remove as views security-definer criadas anteriormente
DROP VIEW IF EXISTS public.donations_staff;
DROP VIEW IF EXISTS public.payments_staff;
DROP VIEW IF EXISTS public.tenants_staff;

-- Restaura SELECT policy para staff/admin (proteção por coluna abaixo)
DROP POLICY IF EXISTS donations_select_own_or_admin ON public.donations;
CREATE POLICY donations_select
  ON public.donations
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      profile_id = auth.uid()
      OR public.is_tenant_staff(auth.uid(), tenant_id)
      OR public.is_platform_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS payments_select_own_or_admin ON public.payments;
CREATE POLICY payments_select
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      profile_id = auth.uid()
      OR public.is_tenant_staff(auth.uid(), tenant_id)
      OR public.is_platform_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS tenants_platform_admin_select ON public.tenants;
CREATE POLICY tenants_staff_select
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_staff(auth.uid(), id)
    OR public.is_platform_admin(auth.uid())
  );

-- TENANTS: restringe colunas legíveis pelo PostgREST a campos não-sensíveis
REVOKE SELECT ON public.tenants FROM anon, authenticated;
GRANT SELECT (
  id, name, slug, logo_url, primary_color, secondary_color, accent_color,
  custom_domain, active, created_at, tagline, cover_photo_url,
  recipient_status, recipient_error, document_type, deleted_at
) ON public.tenants TO authenticated;
-- service_role mantém acesso total
GRANT ALL ON public.tenants TO service_role;

-- DONATIONS: oculta PII e dados de cartão para todos os roles via PostgREST
REVOKE SELECT ON public.donations FROM anon, authenticated;
GRANT SELECT (
  id, tenant_id, profile_id, amount, payment_id, created_at,
  cost_center_id, campaign_id, installments, payment_method,
  gross_amount, net_amount, admin_fee, receipt_url, deleted_at
) ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;

-- PAYMENTS: oculta splits, recebedores, taxas e payloads do gateway
REVOKE SELECT ON public.payments FROM anon, authenticated;
GRANT SELECT (
  id, tenant_id, profile_id, amount, method, status,
  reference_type, reference_id, gateway_id, created_at,
  donation_amount, cost_center_id, card_brand, deleted_at
) ON public.payments TO authenticated;
GRANT UPDATE ON public.payments TO authenticated; -- mantém policy de update staff
GRANT ALL ON public.payments TO service_role;

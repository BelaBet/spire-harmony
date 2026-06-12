
-- 1) cost_centers: hide internal split percentages from tenant staff
REVOKE SELECT (split_platform_percent, split_seller_percent) ON public.cost_centers FROM authenticated, anon;

-- 2) donations: keep donors able to see basics, but block PII/fee breakdown via Data API for authenticated
--    (service_role retains full access for server-side reads)
REVOKE SELECT (donor_email, donor_phone, donor_document, donor_name,
               card_last_four, card_brand, net_amount, admin_fee, gross_amount, gateway_id)
  ON public.donations FROM authenticated, anon;

-- 3) fee_rules: block internal margin columns from tenant staff
REVOKE SELECT (tk2_op_percent, tk2_op_fixed, acquirer_fee_percent, anticipation_percent, adm_fee_percent)
  ON public.fee_rules FROM authenticated, anon;

-- 4) payments: block gateway internals and fee breakdown from clients
REVOKE SELECT (gateway_request, gateway_response, platform_recipient_id, seller_recipient_id,
               split_platform_amount, split_seller_amount, tk2_op_fee, pagarme_fee,
               card_brand, error_message)
  ON public.payments FROM authenticated, anon;

-- 5) tenant_financial_config: ensure sensitive recipient/split fields are not exposed via Data API
REVOKE SELECT (pagarme_recipient_id, split_platform_percent) ON public.tenant_financial_config FROM authenticated, anon;

-- 6) tenants: block banking/KYC fields from tenant staff (admin/platform read via service_role)
DO $$
DECLARE
  col text;
  cols text[] := ARRAY['recipient_id','holder_document','bank_account','bank_account_dv','bank_code','legal_name','document','account_type'];
BEGIN
  FOREACH col IN ARRAY cols LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='tenants' AND column_name=col) THEN
      EXECUTE format('REVOKE SELECT (%I) ON public.tenants FROM authenticated, anon', col);
    END IF;
  END LOOP;
END $$;

-- 7) group_members: tighten realtime/SELECT policy to avoid ambiguous current_tenant_id()
DROP POLICY IF EXISTS group_members_self_select ON public.group_members;
CREATE POLICY group_members_self_select ON public.group_members
  FOR SELECT
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_members.group_id
        AND is_tenant_staff(auth.uid(), g.tenant_id)
    )
  );

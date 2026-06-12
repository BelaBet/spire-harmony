-- 1. donations: re-apply + add gross/admin/net to protected columns
REVOKE SELECT (donor_name, donor_email, donor_phone, donor_document, card_brand, card_last_four, gateway_id, net_amount, admin_fee, gross_amount)
  ON public.donations FROM authenticated, anon;

-- 2. payments: re-apply revoke of all gateway/recipient columns
REVOKE SELECT (platform_recipient_id, seller_recipient_id, gateway_id, gateway_request, gateway_response)
  ON public.payments FROM authenticated, anon;

-- 3. tenants: re-apply revoke of all sensitive columns
REVOKE SELECT (recipient_id, holder_document, holder_name, legal_name, bank_code, bank_account, bank_agency, bank_account_dv, institutional_email, document)
  ON public.tenants FROM authenticated, anon;

-- 4. tenant_legal_responsible: replace ALL policy with explicit INSERT/UPDATE/DELETE so SELECT is not implicitly granted to managers.
DROP POLICY IF EXISTS legal_resp_staff_write ON public.tenant_legal_responsible;
CREATE POLICY legal_resp_staff_insert ON public.tenant_legal_responsible
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE POLICY legal_resp_staff_update ON public.tenant_legal_responsible
  FOR UPDATE TO authenticated
  USING (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE POLICY legal_resp_staff_delete ON public.tenant_legal_responsible
  FOR DELETE TO authenticated
  USING (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
-- 1. cost_centers: hide platform/seller split percents from tenant staff
REVOKE SELECT (split_platform_percent, split_seller_percent) ON public.cost_centers FROM authenticated;
REVOKE SELECT (split_platform_percent, split_seller_percent) ON public.cost_centers FROM anon;

-- 2. donations: hide PII, card data, fee breakdown, gateway id
REVOKE SELECT (
  donor_document, donor_email, donor_phone, donor_name,
  card_last_four, card_brand,
  net_amount, admin_fee, gross_amount,
  gateway_id
) ON public.donations FROM authenticated;
REVOKE SELECT (
  donor_document, donor_email, donor_phone, donor_name,
  card_last_four, card_brand,
  net_amount, admin_fee, gross_amount,
  gateway_id
) ON public.donations FROM anon;

-- 3. fee_rules: hide platform margin columns
REVOKE SELECT (acquirer_fee_percent, tk2_op_fixed, tk2_op_percent, anticipation_percent)
  ON public.fee_rules FROM authenticated;
REVOKE SELECT (acquirer_fee_percent, tk2_op_fixed, tk2_op_percent, anticipation_percent)
  ON public.fee_rules FROM anon;

-- 4. payments: hide gateway internals + split details
REVOKE SELECT (
  gateway_request, gateway_response,
  seller_recipient_id, platform_recipient_id,
  split_seller_amount, split_platform_amount,
  pagarme_fee, tk2_op_fee,
  gateway_id
) ON public.payments FROM authenticated;
REVOKE SELECT (
  gateway_request, gateway_response,
  seller_recipient_id, platform_recipient_id,
  split_seller_amount, split_platform_amount,
  pagarme_fee, tk2_op_fee,
  gateway_id
) ON public.payments FROM anon;

-- 5. tenant_financial_config: prevent staff from writing platform split percent
REVOKE INSERT (split_platform_percent), UPDATE (split_platform_percent)
  ON public.tenant_financial_config FROM authenticated;
REVOKE INSERT (split_platform_percent), UPDATE (split_platform_percent)
  ON public.tenant_financial_config FROM anon;

-- 5b. Allow tenant staff to read their own financial config (sensitive cols already revoked)
DROP POLICY IF EXISTS "fin_cfg_staff_select" ON public.tenant_financial_config;
CREATE POLICY "fin_cfg_staff_select"
  ON public.tenant_financial_config
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_staff(auth.uid(), tenant_id)
    OR public.is_platform_admin(auth.uid())
  );

-- Also revoke the sensitive split percent from staff at the column level
REVOKE SELECT (split_platform_percent) ON public.tenant_financial_config FROM authenticated;
REVOKE SELECT (split_platform_percent) ON public.tenant_financial_config FROM anon;

-- 6. tenants: hide banking/recipient/document/document holder data from tenant staff
REVOKE SELECT (
  holder_document, holder_name,
  bank_code, bank_agency, bank_account, bank_account_dv, account_type,
  recipient_id, document, recipient_error
) ON public.tenants FROM authenticated;
REVOKE SELECT (
  holder_document, holder_name,
  bank_code, bank_agency, bank_account, bank_account_dv, account_type,
  recipient_id, document, recipient_error
) ON public.tenants FROM anon;

-- 7. user_roles: explicit deny against any self-insert or non-admin write to close the gap
DROP POLICY IF EXISTS "user_roles_block_self_insert" ON public.user_roles;
CREATE POLICY "user_roles_block_self_insert"
  ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id <> auth.uid()
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "user_roles_block_self_update" ON public.user_roles;
CREATE POLICY "user_roles_block_self_update"
  ON public.user_roles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    user_id <> auth.uid()
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role)
    )
  )
  WITH CHECK (
    user_id <> auth.uid()
    AND (
      public.is_platform_admin(auth.uid())
      OR public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role)
    )
  );
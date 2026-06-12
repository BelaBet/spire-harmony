REVOKE SELECT (split_platform_percent, split_seller_percent) ON public.cost_centers FROM authenticated, anon;

REVOKE SELECT (
  donor_email, donor_phone, donor_document, donor_name,
  card_last_four, card_brand,
  net_amount, admin_fee, gross_amount, gateway_id
) ON public.donations FROM authenticated, anon;

REVOKE SELECT (
  gateway_id, gateway_request, gateway_response,
  platform_recipient_id, seller_recipient_id,
  split_platform_amount, split_seller_amount,
  pagarme_fee, tk2_op_fee, card_brand
) ON public.payments FROM authenticated, anon;

REVOKE SELECT (
  pagarme_recipient_id, pagarme_recipient_status,
  split_platform_percent, auto_anticipation,
  anticipation_model, anticipation_days
) ON public.tenant_financial_config FROM authenticated, anon;

REVOKE SELECT (
  holder_document, holder_name,
  bank_code, bank_agency, bank_account, bank_account_dv, account_type,
  recipient_id, recipient_status, recipient_error,
  document, legal_name, compliance_status
) ON public.tenants FROM authenticated, anon;

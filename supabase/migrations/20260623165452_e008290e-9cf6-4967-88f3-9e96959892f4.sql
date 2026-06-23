
-- cost_centers: anon and authenticated can read only safe columns
REVOKE SELECT ON public.cost_centers FROM anon;
GRANT SELECT (id, tenant_id, name, slug, type, description, allows_installments, max_installments, is_active, qr_code_url, display_order, created_at, updated_at) ON public.cost_centers TO anon;

REVOKE SELECT ON public.cost_centers FROM authenticated;
GRANT SELECT (id, tenant_id, name, slug, type, description, allows_installments, max_installments, is_active, qr_code_url, display_order, created_at, updated_at) ON public.cost_centers TO authenticated;

-- fee_rules: hide internal fee columns
REVOKE SELECT ON public.fee_rules FROM authenticated;
GRANT SELECT (id, tenant_id, payment_method, who_pays, is_active, created_at) ON public.fee_rules TO authenticated;
REVOKE SELECT ON public.fee_rules FROM anon;

-- payments: hide gateway/split columns
REVOKE SELECT ON public.payments FROM authenticated;
GRANT SELECT (
  id, tenant_id, profile_id, amount, method, status, reference_type, reference_id,
  gateway_id, created_at, deleted_at, deleted_by, donation_amount, ticketto_fee,
  error_message, transacao_fee, card_brand, cost_center_id
) ON public.payments TO authenticated;
REVOKE SELECT ON public.payments FROM anon;

-- tenant_financial_config: hide pagarme/anticipation columns
REVOKE SELECT ON public.tenant_financial_config FROM authenticated;
GRANT SELECT (id, tenant_id, receiver_type, use_pagarme, auto_transfer, transfer_frequency, created_at, updated_at) ON public.tenant_financial_config TO authenticated;
REVOKE SELECT ON public.tenant_financial_config FROM anon;

-- tenants: hide recipient/legal columns
REVOKE SELECT ON public.tenants FROM authenticated;
GRANT SELECT (
  id, name, slug, logo_url, primary_color, secondary_color, custom_domain, active,
  created_at, tagline, cover_photo_url, accent_color, deleted_at, deleted_by,
  document_type, trade_name, institutional_email, main_phone, website, description,
  compliance_status, financial_active, updated_at
) ON public.tenants TO authenticated;
REVOKE SELECT ON public.tenants FROM anon;

-- donations: hide donor_document (CPF) from authenticated
REVOKE SELECT ON public.donations FROM authenticated;
GRANT SELECT (
  id, tenant_id, profile_id, amount, campaign_id, payment_id, receipt_url,
  created_at, deleted_at, deleted_by, donor_name, donor_phone, donor_email,
  gross_amount, admin_fee, net_amount, payment_method, card_brand, card_last_four,
  gateway_id, installments, cost_center_id
) ON public.donations TO authenticated;
REVOKE SELECT ON public.donations FROM anon;

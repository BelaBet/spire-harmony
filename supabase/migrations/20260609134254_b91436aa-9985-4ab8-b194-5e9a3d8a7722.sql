DROP POLICY IF EXISTS payments_insert_self ON public.payments;
CREATE POLICY payments_insert_self ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id IS NOT NULL
    AND profile_id = auth.uid()
    AND tenant_id IS NOT NULL
    AND tenant_id = current_tenant_id()
  );
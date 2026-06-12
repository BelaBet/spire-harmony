
-- =====================================================================
-- Fase 1 — Onboarding padronizado: identidade, compliance e blocos
-- =====================================================================

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.tenant_compliance_status AS ENUM
    ('pending_documents','pending_financial_setup','active','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tenant_bank_account_type AS ENUM
    ('checking','checking_joint','savings','savings_joint');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tenant_receiver_type AS ENUM ('pf','pj');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tenant_transfer_frequency AS ENUM ('daily','weekly','monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tenant_doc_status AS ENUM ('pending','submitted','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tenants: novos campos institucionais + status compliance
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS trade_name          text,
  ADD COLUMN IF NOT EXISTS institutional_email text,
  ADD COLUMN IF NOT EXISTS main_phone          text,
  ADD COLUMN IF NOT EXISTS website             text,
  ADD COLUMN IF NOT EXISTS description         text,
  ADD COLUMN IF NOT EXISTS compliance_status   public.tenant_compliance_status NOT NULL DEFAULT 'pending_documents',
  ADD COLUMN IF NOT EXISTS financial_active    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz NOT NULL DEFAULT now();

-- Restringe leitura dos novos campos sensíveis ao service_role
-- (mantém colunas seguras visíveis ao authenticated via column-level grant)
REVOKE SELECT ON public.tenants FROM authenticated;
GRANT SELECT (
  id, name, slug, logo_url, primary_color, secondary_color, accent_color,
  custom_domain, active, created_at, tagline, cover_photo_url,
  document, document_type, trade_name, institutional_email, main_phone,
  website, description, compliance_status, financial_active, updated_at
) ON public.tenants TO authenticated;

-- 3. tenant_legal_responsible
CREATE TABLE IF NOT EXISTS public.tenant_legal_responsible (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  cpf             text NOT NULL,
  email           text,
  birth_date      date,
  mother_name     text,
  role            text,
  monthly_revenue numeric(14,2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_legal_responsible TO authenticated;
GRANT ALL ON public.tenant_legal_responsible TO service_role;
ALTER TABLE public.tenant_legal_responsible ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legal_resp_staff_select" ON public.tenant_legal_responsible
  FOR SELECT TO authenticated
  USING (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "legal_resp_staff_write" ON public.tenant_legal_responsible
  FOR ALL TO authenticated
  USING (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- 4. tenant_address
CREATE TABLE IF NOT EXISTS public.tenant_address (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  cep              text NOT NULL,
  street           text NOT NULL,
  number           text,
  no_number        boolean NOT NULL DEFAULT false,
  complement       text,
  neighborhood     text NOT NULL,
  city             text NOT NULL,
  state            text NOT NULL,
  uf               char(2) NOT NULL,
  reference_point  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_address TO authenticated;
GRANT ALL ON public.tenant_address TO service_role;
ALTER TABLE public.tenant_address ENABLE ROW LEVEL SECURITY;
CREATE POLICY "address_staff_select" ON public.tenant_address
  FOR SELECT TO authenticated
  USING (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "address_staff_write" ON public.tenant_address
  FOR ALL TO authenticated
  USING (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- 5. tenant_contact_phone (1:N)
CREATE TABLE IF NOT EXISTS public.tenant_contact_phone (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone_type  text NOT NULL,
  ddd         text NOT NULL,
  number      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenant_contact_phone_tenant ON public.tenant_contact_phone(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_contact_phone TO authenticated;
GRANT ALL ON public.tenant_contact_phone TO service_role;
ALTER TABLE public.tenant_contact_phone ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phone_staff_all" ON public.tenant_contact_phone
  FOR ALL TO authenticated
  USING (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- 6. tenant_bank_account — sensível: SELECT só service_role
CREATE TABLE IF NOT EXISTS public.tenant_bank_account (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  bank_code        text NOT NULL,
  branch           text NOT NULL,
  branch_digit     text,
  account          text NOT NULL,
  account_digit    text NOT NULL,
  account_type     public.tenant_bank_account_type NOT NULL,
  holder_name      text NOT NULL,
  holder_document  text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
-- Sem GRANT SELECT para authenticated — dados bancários só pelo backend
GRANT INSERT, UPDATE, DELETE ON public.tenant_bank_account TO authenticated;
GRANT ALL ON public.tenant_bank_account TO service_role;
ALTER TABLE public.tenant_bank_account ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_staff_write" ON public.tenant_bank_account
  FOR ALL TO authenticated
  USING (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- 7. tenant_financial_config — sensível: SELECT só service_role
CREATE TABLE IF NOT EXISTS public.tenant_financial_config (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  receiver_type            public.tenant_receiver_type NOT NULL DEFAULT 'pj',
  use_pagarme              boolean NOT NULL DEFAULT true,
  pagarme_recipient_id     text,
  pagarme_recipient_status text,
  split_platform_percent   numeric(6,5) NOT NULL DEFAULT 0.0415,
  auto_anticipation        boolean NOT NULL DEFAULT false,
  anticipation_model       text,
  anticipation_days        integer,
  auto_transfer            boolean NOT NULL DEFAULT false,
  transfer_frequency       public.tenant_transfer_frequency,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT, UPDATE, DELETE ON public.tenant_financial_config TO authenticated;
GRANT ALL ON public.tenant_financial_config TO service_role;
ALTER TABLE public.tenant_financial_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_cfg_staff_write" ON public.tenant_financial_config
  FOR ALL TO authenticated
  USING (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- 8. tenant_pending_documents (1:N) — staff lê o próprio
CREATE TABLE IF NOT EXISTS public.tenant_pending_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  doc_type    text NOT NULL,
  label       text NOT NULL,
  required    boolean NOT NULL DEFAULT true,
  status      public.tenant_doc_status NOT NULL DEFAULT 'pending',
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, doc_type)
);
CREATE INDEX IF NOT EXISTS idx_pending_docs_tenant ON public.tenant_pending_documents(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_pending_documents TO authenticated;
GRANT ALL ON public.tenant_pending_documents TO service_role;
ALTER TABLE public.tenant_pending_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pending_docs_staff_select" ON public.tenant_pending_documents
  FOR SELECT TO authenticated
  USING (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "pending_docs_platform_write" ON public.tenant_pending_documents
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- 9. Triggers updated_at
DO $$ BEGIN
  CREATE TRIGGER trg_legal_resp_updated BEFORE UPDATE ON public.tenant_legal_responsible
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_address_updated BEFORE UPDATE ON public.tenant_address
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_bank_updated BEFORE UPDATE ON public.tenant_bank_account
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_fincfg_updated BEFORE UPDATE ON public.tenant_financial_config
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_pending_docs_updated BEFORE UPDATE ON public.tenant_pending_documents
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 10. Função para semear documentos padrão e recomputar compliance
CREATE OR REPLACE FUNCTION public.seed_tenant_pending_documents(_tenant_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.tenant_pending_documents (tenant_id, doc_type, label, required)
  VALUES
    (_tenant_id, 'cnpj_card',         'Cartão CNPJ',                true),
    (_tenant_id, 'responsible_doc',   'Documento do Responsável',   true),
    (_tenant_id, 'bank_proof',        'Comprovante Bancário',       true),
    (_tenant_id, 'bylaws',            'Estatuto Social',            false),
    (_tenant_id, 'board_minutes',     'Ata da Diretoria',           false),
    (_tenant_id, 'address_proof',     'Comprovante de Endereço',    false)
  ON CONFLICT (tenant_id, doc_type) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public.recompute_tenant_compliance(_tenant_id uuid)
RETURNS public.tenant_compliance_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_resp     boolean;
  has_addr     boolean;
  has_bank     boolean;
  has_fin      boolean;
  has_recipient boolean;
  required_pending int;
  new_status   public.tenant_compliance_status;
  fin_active   boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.tenant_legal_responsible WHERE tenant_id=_tenant_id) INTO has_resp;
  SELECT EXISTS(SELECT 1 FROM public.tenant_address           WHERE tenant_id=_tenant_id) INTO has_addr;
  SELECT EXISTS(SELECT 1 FROM public.tenant_bank_account      WHERE tenant_id=_tenant_id) INTO has_bank;
  SELECT EXISTS(SELECT 1 FROM public.tenant_financial_config  WHERE tenant_id=_tenant_id) INTO has_fin;
  SELECT EXISTS(
    SELECT 1 FROM public.tenant_financial_config
    WHERE tenant_id=_tenant_id
      AND pagarme_recipient_id IS NOT NULL
      AND pagarme_recipient_status IN ('registered','active','approved')
  ) INTO has_recipient;
  SELECT count(*) FROM public.tenant_pending_documents
    WHERE tenant_id=_tenant_id AND required=true AND status <> 'approved'
    INTO required_pending;

  IF required_pending > 0 THEN
    new_status := 'pending_documents';
  ELSIF NOT (has_resp AND has_addr AND has_bank AND has_fin AND has_recipient) THEN
    new_status := 'pending_financial_setup';
  ELSE
    new_status := 'active';
  END IF;

  fin_active := (new_status = 'active');

  UPDATE public.tenants
    SET compliance_status = new_status,
        financial_active  = fin_active
    WHERE id = _tenant_id;

  RETURN new_status;
END $$;

GRANT EXECUTE ON FUNCTION public.seed_tenant_pending_documents(uuid)  TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_tenant_compliance(uuid)    TO service_role, authenticated;

-- 11. Triggers para recomputar compliance automaticamente
CREATE OR REPLACE FUNCTION public.trg_recompute_compliance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _tid uuid;
BEGIN
  _tid := COALESCE(NEW.tenant_id, OLD.tenant_id);
  PERFORM public.recompute_tenant_compliance(_tid);
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_resp_compliance AFTER INSERT OR UPDATE OR DELETE ON public.tenant_legal_responsible
    FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_compliance();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_addr_compliance AFTER INSERT OR UPDATE OR DELETE ON public.tenant_address
    FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_compliance();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_bank_compliance AFTER INSERT OR UPDATE OR DELETE ON public.tenant_bank_account
    FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_compliance();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_fincfg_compliance AFTER INSERT OR UPDATE OR DELETE ON public.tenant_financial_config
    FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_compliance();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_docs_compliance AFTER INSERT OR UPDATE OR DELETE ON public.tenant_pending_documents
    FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_compliance();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

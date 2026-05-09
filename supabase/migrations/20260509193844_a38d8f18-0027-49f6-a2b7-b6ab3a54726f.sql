
-- Enums
CREATE TYPE public.app_role AS ENUM ('member', 'manager', 'admin');
CREATE TYPE public.profile_status AS ENUM ('pending', 'approved', 'blocked');
CREATE TYPE public.event_type AS ENUM ('event', 'campaign', 'donation');
CREATE TYPE public.event_status AS ENUM ('draft', 'active', 'closed');
CREATE TYPE public.ticket_status AS ENUM ('active', 'used', 'cancelled');
CREATE TYPE public.payment_method AS ENUM ('pix', 'credit_card', 'debit_card');
CREATE TYPE public.payment_status AS ENUM ('pending', 'confirmed', 'failed', 'refunded');
CREATE TYPE public.payment_ref_type AS ENUM ('ticket', 'donation');
CREATE TYPE public.message_channel AS ENUM ('sms', 'whatsapp', 'in_app');
CREATE TYPE public.message_target_type AS ENUM ('individual', 'group', 'broadcast');
CREATE TYPE public.message_status AS ENUM ('queued', 'sent', 'failed');
CREATE TYPE public.api_service AS ENUM ('sms', 'whatsapp', 'payments');

-- Tenants
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1a1a1a',
  secondary_color TEXT DEFAULT '#f5f5f5',
  custom_domain TEXT UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  status public.profile_status NOT NULL DEFAULT 'pending',
  avatar_url TEXT,
  lgpd_consent BOOLEAN NOT NULL DEFAULT false,
  lgpd_consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);

-- Roles (separate table to prevent privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _tenant_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_staff(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND role IN ('manager','admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
$$;

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ,
  location TEXT,
  capacity INTEGER,
  ticket_price NUMERIC(10,2) DEFAULT 0,
  type public.event_type NOT NULL DEFAULT 'event',
  status public.event_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_tenant ON public.events(tenant_id);

-- Tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  qr_code_data TEXT,
  status public.ticket_status NOT NULL DEFAULT 'active',
  payment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_tenant ON public.tickets(tenant_id);
CREATE INDEX idx_tickets_profile ON public.tickets(profile_id);

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  method public.payment_method NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  reference_type public.payment_ref_type,
  reference_id UUID,
  gateway_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_tenant ON public.payments(tenant_id);

-- Donations
CREATE TABLE public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  campaign_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_donations_tenant ON public.donations(tenant_id);

-- Groups
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_groups_tenant ON public.groups(tenant_id);

CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, profile_id)
);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  channel public.message_channel NOT NULL,
  target_type public.message_target_type NOT NULL,
  target_id UUID,
  content TEXT NOT NULL,
  status public.message_status NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_tenant ON public.messages(tenant_id);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_profile ON public.notifications(profile_id);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_tenant ON public.audit_logs(tenant_id);

-- API keys
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  service public.api_service NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _tenant_id UUID;
  _slug TEXT;
BEGIN
  _slug := COALESCE(NEW.raw_user_meta_data->>'tenant_slug', 'default');
  SELECT id INTO _tenant_id FROM public.tenants WHERE slug = _slug LIMIT 1;
  IF _tenant_id IS NULL THEN
    SELECT id INTO _tenant_id FROM public.tenants WHERE slug = 'default' LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, tenant_id, full_name, email, lgpd_consent, lgpd_consent_at, status)
  VALUES (
    NEW.id,
    _tenant_id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'lgpd_consent')::boolean, false),
    CASE WHEN (NEW.raw_user_meta_data->>'lgpd_consent')::boolean THEN now() ELSE NULL END,
    'approved'
  );

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, _tenant_id, 'member');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed default tenant
INSERT INTO public.tenants (name, slug, primary_color, secondary_color)
VALUES ('Comunidade Demo', 'default', '#7c3aed', '#fbbf24');

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Tenants: anyone can read (needed for public landing); only admins can update
CREATE POLICY "tenants_select_all" ON public.tenants FOR SELECT USING (true);
CREATE POLICY "tenants_admin_update" ON public.tenants FOR UPDATE
  USING (public.has_role(auth.uid(), id, 'admin'));

-- Profiles
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_tenant_staff(auth.uid(), tenant_id));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.is_tenant_staff(auth.uid(), tenant_id));
CREATE POLICY "profiles_staff_delete" ON public.profiles FOR DELETE
  USING (public.has_role(auth.uid(), tenant_id, 'admin'));

-- User roles: viewable by self/staff, only admins manage
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.is_tenant_staff(auth.uid(), tenant_id));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), tenant_id, 'admin'))
  WITH CHECK (public.has_role(auth.uid(), tenant_id, 'admin'));

-- Events: tenant members read active; staff manage
CREATE POLICY "events_tenant_select" ON public.events FOR SELECT
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "events_staff_all" ON public.events FOR ALL
  USING (public.is_tenant_staff(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_staff(auth.uid(), tenant_id));

-- Tickets: own tickets or staff
CREATE POLICY "tickets_select" ON public.tickets FOR SELECT
  USING (profile_id = auth.uid() OR public.is_tenant_staff(auth.uid(), tenant_id));
CREATE POLICY "tickets_insert_self" ON public.tickets FOR INSERT
  WITH CHECK (profile_id = auth.uid() AND tenant_id = public.current_tenant_id());
CREATE POLICY "tickets_staff_update" ON public.tickets FOR UPDATE
  USING (public.is_tenant_staff(auth.uid(), tenant_id));

-- Payments
CREATE POLICY "payments_select" ON public.payments FOR SELECT
  USING (profile_id = auth.uid() OR public.is_tenant_staff(auth.uid(), tenant_id));
CREATE POLICY "payments_insert_self" ON public.payments FOR INSERT
  WITH CHECK (profile_id = auth.uid() AND tenant_id = public.current_tenant_id());
CREATE POLICY "payments_staff_update" ON public.payments FOR UPDATE
  USING (public.is_tenant_staff(auth.uid(), tenant_id));

-- Donations
CREATE POLICY "donations_select" ON public.donations FOR SELECT
  USING (profile_id = auth.uid() OR public.is_tenant_staff(auth.uid(), tenant_id));
CREATE POLICY "donations_insert_self" ON public.donations FOR INSERT
  WITH CHECK (profile_id = auth.uid() AND tenant_id = public.current_tenant_id());

-- Groups
CREATE POLICY "groups_tenant_select" ON public.groups FOR SELECT
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "groups_staff_all" ON public.groups FOR ALL
  USING (public.is_tenant_staff(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_staff(auth.uid(), tenant_id));

-- Group members
CREATE POLICY "group_members_tenant_select" ON public.group_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.tenant_id = public.current_tenant_id()));
CREATE POLICY "group_members_staff_all" ON public.group_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND public.is_tenant_staff(auth.uid(), g.tenant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND public.is_tenant_staff(auth.uid(), g.tenant_id)));

-- Messages
CREATE POLICY "messages_staff_select" ON public.messages FOR SELECT
  USING (public.is_tenant_staff(auth.uid(), tenant_id));
CREATE POLICY "messages_staff_insert" ON public.messages FOR INSERT
  WITH CHECK (public.is_tenant_staff(auth.uid(), tenant_id));

-- Notifications
CREATE POLICY "notifications_self_select" ON public.notifications FOR SELECT
  USING (profile_id = auth.uid());
CREATE POLICY "notifications_self_update" ON public.notifications FOR UPDATE
  USING (profile_id = auth.uid());
CREATE POLICY "notifications_staff_insert" ON public.notifications FOR INSERT
  WITH CHECK (public.is_tenant_staff(auth.uid(), tenant_id));

-- Audit logs
CREATE POLICY "audit_staff_select" ON public.audit_logs FOR SELECT
  USING (public.is_tenant_staff(auth.uid(), tenant_id));

-- API keys
CREATE POLICY "api_keys_admin_all" ON public.api_keys FOR ALL
  USING (public.has_role(auth.uid(), tenant_id, 'admin'))
  WITH CHECK (public.has_role(auth.uid(), tenant_id, 'admin'));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('tenant-logos', 'tenant-logos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false) ON CONFLICT DO NOTHING;

CREATE POLICY "Public read tenant logos" ON storage.objects FOR SELECT USING (bucket_id = 'tenant-logos');
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload avatars" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatars" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users read own receipts" ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

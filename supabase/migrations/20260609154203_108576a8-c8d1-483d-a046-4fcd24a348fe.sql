ALTER VIEW public.tenants_public SET (security_invoker = false);
GRANT SELECT ON public.tenants_public TO anon, authenticated;
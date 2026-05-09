# White-Label Religious Establishment Platform — Build Plan

This is a large full-stack SaaS. To ship something solid (and avoid a giant unusable first version), I'll build it in **phases**, getting each layer working before stacking the next. Phase 1 lays the foundation; later phases add operational features.

---

## Phase 1 — Foundation (this turn)

**Backend (Lovable Cloud / Supabase)**
- Enable Lovable Cloud
- Create all tables from your spec with proper FKs and indexes
- Create `app_role` enum (`member` | `manager` | `admin`) and store roles via `has_role()` security-definer function (no role on profiles — prevents privilege escalation)
- Helper function `current_tenant_id()` returning the caller's tenant
- RLS on every table — strict tenant isolation: a user only sees rows where `tenant_id = current_tenant_id()`; managers/admins get write access via `has_role()`
- Auto-create profile row on signup via `on_auth_user_created` trigger (captures tenant from signup metadata + LGPD consent)
- Storage buckets: `tenant-logos` (public), `avatars` (public), `receipts` (private)

**Frontend**
- Design system in `src/styles.css` — modern, mobile-first, semantic tokens (oklch). Default palette: warm neutrals + a single configurable brand accent that gets overridden per tenant at runtime via CSS vars from `tenants.primary_color`/`secondary_color`.
- `TenantProvider` — resolves tenant from subdomain/slug, loads branding, injects CSS vars and logo
- `AuthProvider` — Supabase session, role checks via `has_role` RPC
- Routes:
  - `/` — public landing (white-label, shows tenant logo/name)
  - `/login`, `/signup` (signup captures LGPD consent checkbox + timestamp)
  - `/_authenticated/*` layout guard
  - `/_authenticated/dashboard` — role-aware home (member sees events/donations; manager/admin sees stats)
  - `/_authenticated/events` — list + detail
  - `/_authenticated/profile` — view/edit, LGPD data export (JSON download), account anonymization request

**LGPD**
- Consent checkbox required on signup, stored with timestamp
- Profile page: "Export my data" (server fn returns full user JSON) + "Anonymize my account" (nulls PII, keeps audit trail)

---

## Phase 2 — Events, tickets, payments (next turn)
- Manager event CRUD, member RSVP/ticket purchase
- QR code generation for tickets, scan-to-validate page
- Payment flow stub (PIX/card) — gateway integration deferred until you pick one (Stripe? Mercado Pago? Asaas?)

## Phase 3 — Communities & messaging
- Groups + group members management
- In-app messaging + notifications (realtime via Supabase)
- SMS/WhatsApp integration (requires API keys — Twilio? Zenvia?)

## Phase 4 — Admin console
- Tenant management (super-admin), branding editor, custom domain config
- Audit log viewer, API key management
- Donation campaigns + receipts

---

## Technical notes
- Stack: TanStack Start (already configured), Lovable Cloud (Supabase), Tailwind v4, shadcn/ui
- Tenant resolution: Phase 1 uses URL slug (`?tenant=...` or path) for simplicity; custom domain routing added in Phase 4
- All user-facing text in **Portuguese (Brazil)** given LGPD context — confirm if you'd prefer English or bilingual

---

## Questions before I start Phase 1

1. **Language**: pt-BR, English, or both?
2. **Tenant resolution in Phase 1**: subdomain (`acme.app.com`), URL slug (`/t/acme/...`), or single hardcoded tenant for now (simplest — add multi-tenant routing later)?
3. **Payment gateway preference** (for Phase 2): Stripe, Mercado Pago, Asaas, or decide later?
4. **Should I proceed with this phased approach**, or do you want everything attempted in one shot (will be much rougher)?

Reply with answers (or "go" to accept defaults: pt-BR, URL slug, decide gateway later, phased) and I'll start building.
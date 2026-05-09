ARQUITETURA IMPORTANTE — REFATORAÇÃO DE ROLES E SEGURANÇA

REFATORAR o sistema de permissões separando:

1. PLATFORM ROLES

2. TENANT ROLES

NÃO utilizar super_admin dentro da tabela tenant-based user_roles.

---

## NOVA ESTRUTURA

### platform_roles

Responsável por:

- super_admin

- support

- finance

- operator

Tabela separada:

- user_id

- role

- created_at

SEM tenant_id.

---

### tenant_roles

Responsável apenas por permissões da igreja:

- tenant_admin

- manager

Sempre vinculadas ao tenant_id.

---

## SEGURANÇA

Evitar:

- tenant_id NULL para super admin

- mistura de contexto global e tenant

- bypass implícito

---

## IMPERSONAÇÃO

REMOVER:

- localStorage impersonation

Implementar:

- impersonação controlada por auth context/session

- rastreamento obrigatório

- auditoria obrigatória

Registrar:

- impersonation_start

- impersonation_end

- impersonated_tenant

- impersonated_by

---

## AUDITORIA AVANÇADA

Adicionar logs para:

- login

- logout

- falha de acesso

- impersonação

- exportação LGPD

- alterações financeiras

- alterações de billing

- alterações de plano

- mudanças de permissões

---

## SOFT DELETE

Implementar soft delete em:

- tenants

- payments

- donations

- invoices

- subscriptions

Usar:

- deleted_at

- deleted_by

Nunca apagar financeiro permanentemente.

---

## BILLING

Separar:

- billing SaaS da plataforma

- pagamentos/doações da igreja

NÃO misturar domínios financeiros.

---

## LIMITES E QUOTAS

Adicionar:

- limite de storage

- limite de SMS

- limite de WhatsApp

- limite de campanhas

- limite de eventos

- limite de admins

Controlado por plano.

---

## FEATURE FLAGS

Implementar feature flags por plano:

{

  "events": true,

  "sms": true,

  "whatsapp": false,

  "advanced_reports": true

}

---

## IMPORTANTE

MANTER:

- Supabase

- RLS

- multi-tenant

- white label

- dashboard ERP

- auditoria

- mobile-first

- arquitetura SaaS
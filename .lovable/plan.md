## Padronização dos dois fluxos de onboarding

Entrega em **4 fases**. Cada fase é revisável separadamente. Sem upload de arquivos nesta rodada.

---

### Fase 1 — Schema + status de compliance + server fn unificada (esta entrega)

**1.1 Migração de banco**

Estender `tenants` com identidade institucional:
- `trade_name` (nome fantasia), `legal_name` (razão social)
- `institutional_email`, `main_phone`, `website`, `description`
- `compliance_status` enum: `pending_documents | pending_financial_setup | active | blocked` (default `pending_documents`)
- `financial_active` boolean (default false) — gate para PIX/cartão/boleto/transferências/split

Novas tabelas (1:1 com tenant, todas com RLS por tenant + service_role):
- `tenant_legal_responsible` — full_name, cpf, email, birth_date, mother_name, role, monthly_revenue
- `tenant_contact_phone` — phone_type, ddd, number
- `tenant_address` — cep, street, number, no_number bool, complement, neighborhood, city, state, uf, reference_point
- `tenant_bank_account` — bank_code, branch, branch_digit, account, account_digit, account_type enum (`checking | checking_joint | savings | savings_joint`), holder_name, holder_document
- `tenant_financial_config` — receiver_type (`pf|pj`), use_pagarme bool, pagarme_recipient_id, split_platform_percent, auto_anticipation bool, anticipation_model, anticipation_days, auto_transfer bool, transfer_frequency (`daily|weekly|monthly`)
- `tenant_pending_documents` — doc_type, required bool, status (`pending|submitted|approved|rejected`), seed automático dos 3 obrigatórios + 3 opcionais

Migração já com `GRANT` + RLS escopado por `tenant_id` (staff lê do próprio tenant; super_admin lê tudo; service_role full).

**1.2 Server function única: `provisionTenant`**

Substitui `reserveTenantForSignup`. Aceita objeto completo com todas as seções; tudo opcional **exceto** `church_name + document + document_type`. Mesma fn usada pelo Super Admin (objeto cheio) e pelo `/signup` (objeto mínimo).

Fluxo interno:
1. Validar CPF/CNPJ/CEP/e-mail/telefone server-side (zod + cpf-cnpj-validator).
2. Gerar slug único.
3. Inserir tenant com `compliance_status='pending_documents'`, `financial_active=false`.
4. Inserir cada bloco fornecido nas suas tabelas (responsável, endereço, banco, contato, financeiro).
5. Seed de `tenant_pending_documents` (3 obrigatórios + 3 opcionais).
6. Se `use_pagarme=true` e `pagarme_recipient_id` informado: consultar Pagar.me, validar status `registered/active/approved`, salvar. Se ausente/reprovado: gravar pendência financeira e retornar aviso (não bloqueia criação).
7. Criar cost_center "Online" (slug `online`, ativo, até 2x, split conforme onboarding).
8. Gerar QR para `/i/{slug}`.
9. Convidar admin (se informado).
10. Retornar `{ tenant_id, slug, public_url, qr_code_url, cost_center_id, compliance_status, warnings[] }`.

**1.3 Validações locais (zod helpers compartilhados)**

`src/lib/validators/` ganha: `bank.ts`, `cep.ts`, `phone.ts`. CPF/CNPJ já existem. Usados pelo server fn E pelos formulários (mesmo schema).

**1.4 Gate financeiro**

Helper `assertFinancialActive(tenant_id)` chamado em `create-donation`, payments, antecipações e transferências. Bloqueia com mensagem clara enquanto `financial_active=false`.

**1.5 Tela "Pendências de Cadastro"**

Rota `_authenticated/admin.pendencias.tsx`: lista documentos pendentes e status financeiro, com CTA "completar dados". Banner discreto no dashboard quando `compliance_status != 'active'`.

---

### Fase 2 — UI Super Admin completa (próxima)

Refazer `igrejas.onboarding.tsx` como wizard multi-step com todas as seções, consumindo `provisionTenant`. Validações inline reaproveitando os helpers da Fase 1.

### Fase 3 — UI auto-cadastro + "Completar Cadastro"

`/signup` permanece mínimo (igreja + admin). Após login, se `compliance_status != 'active'`, redireciona para wizard `/admin/completar-cadastro` (mesmas seções da Fase 2).

### Fase 4 — Integrações externas

- ViaCEP no preenchimento de endereço (autocomplete).
- Busca de recipient Pagar.me por CNPJ quando `use_pagarme` marcado (encontra recipient já aprovado e vincula).
- Upload de documentos (bucket privado `tenant-documents`) — só depois que essa fase for aprovada.

---

### Detalhes técnicos (Fase 1)

```text
tenants (+colunas)
  ├── tenant_legal_responsible (1:1)
  ├── tenant_address (1:1)
  ├── tenant_bank_account (1:1)
  ├── tenant_contact_phone (1:N)
  ├── tenant_financial_config (1:1)
  └── tenant_pending_documents (1:N)
```

- Todas as novas tabelas têm `tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE`.
- RLS: staff do tenant lê/edita o próprio; super_admin lê/edita tudo; sem acesso anon.
- `tenant_bank_account` e `tenant_financial_config`: `REVOKE SELECT` em colunas sensíveis para `authenticated`, mantendo só `service_role` (alinhado com a política atual de `tenants` banking fields).
- `compliance_status` recalculado por trigger quando responsável/endereço/banco/financeiro forem preenchidos e documentos obrigatórios aprovados.
- `financial_active` só vira `true` quando `compliance_status='active'` E recipient Pagar.me validado.

### Arquivos afetados na Fase 1

- **Migração nova** com toda a estrutura acima.
- `src/lib/tenant-signup.functions.ts` → renomear/expandir para `provisionTenant` (mantém export antigo como alias para não quebrar `/signup`).
- `src/lib/validators/{bank,cep,phone}.ts` novos.
- `src/lib/compliance.ts` novo (helper `assertFinancialActive`).
- `src/routes/_authenticated/admin.pendencias.tsx` novo.
- Banner de pendência no `_authenticated.tsx`.
- Atualizar Security Memory com as novas tabelas sensíveis.

### Fora do escopo desta entrega

- UI nova do Super Admin (Fase 2).
- Wizard de completar cadastro do admin (Fase 3).
- Upload de arquivos / ViaCEP / busca automática de recipient (Fase 4).

Confirma que posso iniciar a Fase 1?
# Centros de Custo (Cost Centers)

Cada igreja terá múltiplos centros de custo (ex.: "Dízimo Online", "Oferta Presencial", "Totem Entrada"). O super admin cria; o admin da igreja só ativa/desativa.

## 1. Banco de dados

### Migration

**Tipo enum** `cost_center_type`: `online`, `presencial`, `totem`.

**Tabela `cost_centers`**:
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK tenants | |
| `name` | text | Ex.: "Dízimo Online" |
| `slug` | text | Único por tenant (`UNIQUE(tenant_id, slug)`) |
| `type` | cost_center_type | |
| `description` | text null | |
| `split_platform_percent` | numeric(5,4) | 0..1 — só super admin altera |
| `split_seller_percent` | numeric(5,4) | 0..1 — `platform+seller=1` (CHECK) |
| `allows_installments` | boolean default true | |
| `max_installments` | int default 1 | |
| `is_active` | boolean default true | admin igreja alterna |
| `qr_code_url` | text null | URL pública do PNG no storage |
| `display_order` | int default 0 | ordem na página pública |
| `created_at`, `updated_at` | timestamptz | trigger updated_at |

GRANTs: `SELECT` para `anon` + `authenticated` (página pública precisa listar centros ativos); `INSERT/UPDATE/DELETE` para `authenticated` (controlado por RLS); `ALL` para `service_role`.

**RLS**:
- `select_active_public` — `anon`+`authenticated`: `is_active = true` (página pública lista).
- `select_staff_all` — `authenticated`: `is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid())` (admin vê inativos também).
- `super_admin_all` — `FOR ALL`: `is_platform_admin(auth.uid())` (cria/edita tudo, inclusive split).
- `church_admin_toggle_active` — `FOR UPDATE`: `is_tenant_staff(auth.uid(), tenant_id)`; o **trigger** `prevent_non_admin_split_change` bloqueia alteração de `split_*`, `name`, `slug`, `type` por quem não é `is_platform_admin`.

**View pública** `cost_centers_public` (somente colunas seguras: id, tenant_id, name, slug, type, description, allows_installments, max_installments, display_order). GRANT SELECT para `anon`.

### QR Code
QR gerado server-side ao criar centro de custo: aponta para `https://<host>/i/<tenant_slug>?cc=<cost_center_slug>` e é salvo no bucket público `cost-center-qrs`.

## 2. Server functions

**`src/lib/cost-centers.functions.ts`**

| Função | Auth | Descrição |
|---|---|---|
| `createCostCenter` | super admin | Valida Zod, gera slug único, persiste, gera QR (lib `qrcode` no handler), upload no bucket, atualiza `qr_code_url`. |
| `updateCostCenterFull` | super admin | Edita tudo, inclusive split. |
| `toggleCostCenterActive` | tenant staff | Apenas `is_active`. |
| `regenerateCostCenterQr` | super admin | Re-gera QR PNG. |
| `listCostCenters` | tenant staff / super admin | Inclui inativos. |

Cliente (página pública) consulta direto via `cost_centers_public` view.

Dependência: `bun add qrcode @types/qrcode`. Importar `qrcode` dentro do handler para evitar bundle no client.

## 3. Integração com pagamentos

`payments`: adicionar coluna `cost_center_id uuid null FK cost_centers`.

Em `src/lib/split.utils.ts`:
- Nova função `calculateAmountsForCostCenter(amount, method, costCenter)` que, **se o centro define `split_platform_percent`**, sobrescreve o cálculo de `tickettoFee` baseado em `adm_percent` por esse percentual customizado.
- `buildSplitPayload` permanece igual (já usa amounts).

`createPayment` (em `payments.functions.ts`): aceita `cost_center_id` opcional. Valida que pertence ao tenant, está ativo, e que o método solicitado é permitido (ex.: se `allows_installments=false` e `installments>1`, rejeita). Persiste na coluna nova.

## 4. UI

### Super Admin (`/super-admin`)
Nova seção `CostCentersSection.tsx` (logo após `RecipientsSection`):
- Seletor de igreja → tabela de centros (`name`, `type`, `split %`, `ativo`, ações).
- Modal `CostCenterFormModal.tsx`: nome, tipo, descrição, split platform/seller %, allows_installments, max_installments, ordem.
- Botão "Baixar QR Code" (abre `qr_code_url`).
- Botão "Regenerar QR".

### Admin da Igreja (`/admin/settings` ou nova rota `/admin/cost-centers`)
`CostCentersAdminPanel.tsx`:
- Lista centros (read-only nas configs sensíveis).
- Toggle `is_active`.
- Botão "Baixar QR" para cada centro.
- Aviso: "Para criar novos centros ou alterar taxas, contate o suporte."

### Página pública (`src/routes/i.$slug.tsx` + `src/routes/index.tsx`)
`ChurchPageView` carrega `cost_centers_public` do tenant ativo (ordenado por `display_order`). Para cada centro: seção com nome/descrição. O `ContribuicaoModal` recebe `costCenter` selecionado e:
- Esconde campo "parcelas" se `allows_installments=false`.
- Envia `cost_center_id` em `createPayment`.
- Query param `?cc=<slug>` pré-seleciona o centro (vindo do QR).

## 5. Arquivos

**Migração**: 1 arquivo com enum, tabela, view, RLS, trigger, GRANTs, bucket.

**Criar**:
- `src/lib/cost-centers.functions.ts`
- `src/components/superadmin/CostCentersSection.tsx`
- `src/components/superadmin/CostCenterFormModal.tsx`
- `src/components/admin/CostCentersAdminPanel.tsx`
- `src/components/CostCenterSelector.tsx` (página pública)

**Editar**:
- `src/lib/split.utils.ts` — split por centro
- `src/lib/payments.functions.ts` — aceitar `cost_center_id`
- `src/components/ContribuicaoModal.tsx` — usar centro
- `src/routes/index.tsx` + `src/routes/i.$slug.tsx` — listar centros
- `src/routes/_authenticated/super-admin.tsx` — injetar seção
- `src/routes/_authenticated/admin.settings.tsx` — painel da igreja

## Perguntas antes de implementar

1. **Split obrigatório por centro?** Os centros sempre sobrescrevem as taxas globais de `fee_rules`/`fees.config.ts`, ou o split do centro é só para a divisão Pagar.me (plataforma vs igreja) e as taxas continuam vindo da config global? Sua descrição cita `split_platform_percent/split_seller_percent` — entendi como % do valor total que vai para cada recipient. Confirma?
2. **`max_installments` é necessário** ou basta `allows_installments` booleano (com máximo padrão definido em `fees.config.ts`)?
3. **QR Code**: gerar PNG via lib `qrcode` server-side e salvar no Storage está OK, ou prefere gerar on-demand no client (sem persistir)?
4. **Página pública**: cada centro vira uma **seção** scrollável na mesma página (como descrito), com um único modal de doação que muda conforme o centro selecionado — correto?

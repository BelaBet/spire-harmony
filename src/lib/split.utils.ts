// Utilitários de split de pagamento Pagar.me V5.
// Todos os valores em CENTAVOS (integer). Nunca usar float.

import { FEES, RECIPIENT_IDS } from "./fees.config";

export type PaymentMethod = "pix" | "credit_card" | "boleto";
export type CardBrand = "master_visa" | "ello_hiper_amex";

export interface SplitAmounts {
  donationAmount: number;       // valor que vai para a igreja (centavos)
  tickettoFee: number;          // taxa ADM 3,5% TK2
  pagarmeFee: number;           // taxa fixa Pagar.me absorvida
  tk2OpFee: number;             // taxa operacional TK2
  transacaoFee: number;         // taxa fixa por transação
  splitPlatformAmount: number;  // total para plataforma TK2
  totalAmount: number;          // total cobrado do doador
}

export interface SplitPayload {
  amount: number;
  recipient_id: string;
  type: "flat";
  options: {
    liable: boolean;
    charge_processing_fee: boolean;
    charge_remainder_fee: boolean;
  };
}

function assertPositiveInt(v: number, name: string) {
  if (!Number.isInteger(v) || v <= 0) {
    throw new Error(`${name} deve ser inteiro positivo em centavos`);
  }
}

// ── PIX ──────────────────────────────────────────────────────
export function calculatePixAmounts(
  ofertaEmCentavos: number,
  splitOverridePercent?: number | null,
): SplitAmounts {
  assertPositiveInt(ofertaEmCentavos, "donationAmount");
  const f = FEES.pix;
  const donationAmount = ofertaEmCentavos;
  const admPercent = splitOverridePercent ?? f.adm_percent;

  const tickettoFee = Math.round(donationAmount * admPercent);
  const pagarmeFee = f.adquirencia_fixa;
  const tk2OpFee = f.tk2_operacional_fixo;
  const transacaoFee = f.transacao_fixa;

  const splitPlatformAmount = tickettoFee + pagarmeFee + tk2OpFee;
  const totalAmount = donationAmount + splitPlatformAmount;

  return {
    donationAmount,
    tickettoFee,
    pagarmeFee,
    tk2OpFee,
    transacaoFee,
    splitPlatformAmount,
    totalAmount,
  };
}

// ── CARTÃO ───────────────────────────────────────────────────
export function calculateCardAmounts(
  ofertaEmCentavos: number,
  installments: number,
  brand: CardBrand,
  splitOverridePercent?: number | null,
): SplitAmounts {
  assertPositiveInt(ofertaEmCentavos, "donationAmount");
  const f = brand === "master_visa" ? FEES.cartao_master_visa : FEES.cartao_ello_hiper_amex;
  const donationAmount = ofertaEmCentavos;
  const admPercent = splitOverridePercent ?? f.adm_percent;

  const tickettoFee = Math.round(donationAmount * admPercent);
  const tk2OpFee = Math.round(donationAmount * f.tk2_op_percent * admPercent);

  const adquirenciaPercent =
    installments <= 1 ? f.adquirencia_avista_percent : f.adquirencia_2x_percent;
  const adquirenciaValor = Math.round(donationAmount * adquirenciaPercent);

  const pagarmeFee = 0;
  const transacaoFee = f.transacao_fixa;

  const splitPlatformAmount = tickettoFee + tk2OpFee;
  const totalAmount = donationAmount + splitPlatformAmount + adquirenciaValor;

  return {
    donationAmount,
    tickettoFee,
    pagarmeFee,
    tk2OpFee,
    transacaoFee,
    splitPlatformAmount,
    totalAmount,
  };
}

// ── BOLETO ───────────────────────────────────────────────────
export function calculateBoletoAmounts(
  ofertaEmCentavos: number,
  splitOverridePercent?: number | null,
): SplitAmounts {
  assertPositiveInt(ofertaEmCentavos, "donationAmount");
  const f = FEES.boleto;
  const donationAmount = ofertaEmCentavos;
  const admPercent = splitOverridePercent ?? f.adm_percent;

  const tickettoFee = Math.round(donationAmount * admPercent);
  const pagarmeFee = f.adquirencia_fixa;
  const tk2OpFee = f.tk2_operacional_fixo;
  const transacaoFee = f.transacao_fixa;

  const splitPlatformAmount = tickettoFee + tk2OpFee;
  const totalAmount = donationAmount + splitPlatformAmount + pagarmeFee;

  return {
    donationAmount,
    tickettoFee,
    pagarmeFee,
    tk2OpFee,
    transacaoFee,
    splitPlatformAmount,
    totalAmount,
  };
}

// ── BUILD SPLIT PAYLOAD ───────────────────────────────────────
export function buildSplitPayload(
  amounts: SplitAmounts,
  sellerRecipientId: string,
): SplitPayload[] {
  if (!sellerRecipientId) {
    throw new Error("seller_recipient_id ausente — instituição não habilitada para pagamentos");
  }
  const platform = RECIPIENT_IDS.platform;
  if (!platform) {
    throw new Error("PLATFORM_RECIPIENT_ID não configurado");
  }

  return [
    {
      amount: amounts.splitPlatformAmount,
      recipient_id: platform,
      type: "flat",
      options: {
        liable: true,
        charge_processing_fee: true,
        charge_remainder_fee: true,
      },
    },
    {
      amount: amounts.donationAmount,
      recipient_id: sellerRecipientId,
      type: "flat",
      options: {
        liable: false,
        charge_processing_fee: false,
        charge_remainder_fee: false,
      },
    },
  ];
}

/**
 * Compat: usado pela UI para estimar o total cobrado.
 * Para cartão usa parcelamento à vista com bandeira master/visa como padrão.
 */
export function calculateAmounts(
  donationAmount: number,
  method: PaymentMethod = "pix",
): SplitAmounts {
  if (method === "pix") return calculatePixAmounts(donationAmount);
  if (method === "boleto") return calculateBoletoAmounts(donationAmount);
  return calculateCardAmounts(donationAmount, 1, "master_visa");
}

/**
 * Busca o recipient_id (ID do recebedor Pagar.me) de um tenant.
 * O valor é armazenado em `tenants.recipient_id` e preenchido manualmente
 * pelo admin no banco. Lança erro caso não esteja configurado.
 */
export async function fetchSellerRecipientId(tenantId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("tenant_financial_config")
    .select("pagarme_recipient_id, use_pagarme")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { pagarme_recipient_id?: string | null; use_pagarme?: boolean | null } | null;
  const recipientId = row?.pagarme_recipient_id;
  if (!recipientId || !row?.use_pagarme) {
    throw new Error("Tenant sem recipient_id configurado na Pagar.me");
  }
  return recipientId;
}

/** Garante que o tenant está habilitado para receber pagamentos. */
export async function assertTenantFinancialActive(tenantId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("financial_active, compliance_status")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { financial_active?: boolean | null; compliance_status?: string | null } | null;
  if (!row?.financial_active) {
    throw new Error("Igreja não habilitada para receber pagamentos");
  }
}

export type CostCenterConfig = {
  id: string;
  tenant_id: string;
  split_platform_percent: number;
  allows_installments: boolean;
  max_installments: number;
  is_active: boolean;
};

/**
 * Busca configuração de um centro de custo, validando que pertence ao tenant
 * e está ativo. Lança erro caso contrário.
 */
export async function fetchCostCenter(
  costCenterId: string,
  tenantId: string,
): Promise<CostCenterConfig> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("cost_centers")
    .select("id, tenant_id, split_platform_percent, allows_installments, max_installments, is_active")
    .eq("id", costCenterId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const cc = data as CostCenterConfig | null;
  if (!cc) throw new Error("Centro de custo não encontrado");
  if (cc.tenant_id !== tenantId) throw new Error("Centro de custo não pertence a esta igreja");
  if (!cc.is_active) throw new Error("Centro de custo está desativado");
  return cc;
}

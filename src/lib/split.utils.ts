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
    charge_remainder_fee: boolean;
    liable: boolean;
    charge_processing_fee: boolean;
  };
}

function assertPositiveInt(v: number, name: string) {
  if (!Number.isInteger(v) || v <= 0) {
    throw new Error(`${name} deve ser inteiro positivo em centavos`);
  }
}

// ── PIX ──────────────────────────────────────────────────────
export function calculatePixAmounts(ofertaEmCentavos: number): SplitAmounts {
  assertPositiveInt(ofertaEmCentavos, "donationAmount");
  const f = FEES.pix;
  const donationAmount = ofertaEmCentavos;

  const tickettoFee = Math.round(donationAmount * f.adm_percent);
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
): SplitAmounts {
  assertPositiveInt(ofertaEmCentavos, "donationAmount");
  const f = brand === "master_visa" ? FEES.cartao_master_visa : FEES.cartao_ello_hiper_amex;
  const donationAmount = ofertaEmCentavos;

  const tickettoFee = Math.round(donationAmount * f.adm_percent);
  const tk2OpFee = Math.round(donationAmount * f.tk2_op_percent * f.adm_percent);

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
export function calculateBoletoAmounts(ofertaEmCentavos: number): SplitAmounts {
  assertPositiveInt(ofertaEmCentavos, "donationAmount");
  const f = FEES.boleto;
  const donationAmount = ofertaEmCentavos;

  const tickettoFee = Math.round(donationAmount * f.adm_percent);
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
        charge_remainder_fee: true,
        liable: true,
        charge_processing_fee: true,
      },
    },
    {
      amount: amounts.donationAmount,
      recipient_id: sellerRecipientId,
      type: "flat",
      options: {
        charge_remainder_fee: false,
        liable: false,
        charge_processing_fee: false,
      },
    },
  ];
}

/**
 * Busca o pagarme_recipient_id de um tenant.
 * Lança erro caso não esteja configurado.
 */
export async function fetchSellerRecipientId(tenantId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("tenant_payment_settings")
    .select("pagarme_recipient_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const recipientId = (data as { pagarme_recipient_id?: string | null } | null)?.pagarme_recipient_id;
  if (!recipientId) {
    throw new Error("Esta instituição ainda não está habilitada para receber pagamentos.");
  }
  return recipientId;
}

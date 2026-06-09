// Utilitários de split de pagamento Pagar.me V5.
// Todos os valores em CENTAVOS (integer). Nunca usar float.

export const TICKETTO_RATE = 0.035; // 3,5% de taxa de administração
export const PIX_FIXED_FEE = 40;    // R$ 0,40 taxa fixa por transação PIX (centavos)

export type PaymentMethod = "pix" | "credit_card" | "boleto";

export type Amounts = {
  donationAmount: number; // valor original que o doador quer doar (centavos)
  tickettoFee: number;    // taxa Ticketto 3,5% (centavos)
  pixFixedFee: number;    // taxa fixa PIX, quando aplicável (centavos)
  totalAmount: number;    // valor cobrado do doador (centavos)
};

/**
 * Calcula a taxa Ticketto e o valor total cobrado a partir do valor da doação.
 * Entrada/saída em CENTAVOS.
 * Para PIX adiciona taxa fixa de R$ 0,40.
 */
export function calculateAmounts(donationAmount: number, method?: PaymentMethod): Amounts {
  if (!Number.isInteger(donationAmount) || donationAmount <= 0) {
    throw new Error("donationAmount deve ser um inteiro positivo em centavos");
  }
  const tickettoFee = Math.round(donationAmount * TICKETTO_RATE);
  const pixFixedFee = method === "pix" ? PIX_FIXED_FEE : 0;
  const totalAmount = donationAmount + tickettoFee + pixFixedFee;
  return { donationAmount, tickettoFee, pixFixedFee, totalAmount };
}

/**
 * Monta o array de split da Pagar.me V5.
 * - Ticketto (plataforma): recebe a taxa de adm e absorve a taxa Pagar.me.
 * - Loja (igreja/ONG): recebe o valor integral da doação.
 */
export function buildSplitPayload(
  donationAmount: number,
  tickettoFee: number,
  sellerRecipientId: string,
) {
  const platformRecipientId = process.env.PLATFORM_RECIPIENT_ID;
  if (!platformRecipientId) {
    throw new Error("PLATFORM_RECIPIENT_ID não configurado");
  }
  if (!sellerRecipientId) {
    throw new Error("Recipient da loja não configurado para este tenant");
  }

  return [
    {
      amount: tickettoFee,
      recipient_id: platformRecipientId,
      type: "flat" as const,
      options: {
        charge_remainder_fee: true,
        liable: true,
        charge_processing_fee: true,
      },
    },
    {
      amount: donationAmount,
      recipient_id: sellerRecipientId,
      type: "flat" as const,
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
  const recipientId = (data as { pagarme_recipient_id?: string | null } | null)
    ?.pagarme_recipient_id;
  if (!recipientId) {
    throw new Error("Esta instituição ainda não está habilitada para receber pagamentos.");
  }
  return recipientId;
}

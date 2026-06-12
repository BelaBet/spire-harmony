import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  buildSplitPayload,
  calculateBoletoAmounts,
  fetchSellerRecipientId,
} from "./split.utils";
import { buildPagarmeCustomer, resolveCustomer, validateDocument } from "./payments-customer";

const InputSchema = z.object({
  tenantId: z.string().uuid(),
  donationAmount: z.number().int().positive().max(100_000_000),
  customerName: z.string().min(1).max(120).optional(),
  customerEmail: z.string().email().optional(),
  customerDocument: z.string().min(8).max(20).optional(),
  customerPhone: z.string().min(10).max(20).optional(),
});

function addBusinessDays(date: Date, days: number) {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

export const createBoletoPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertFinancialActive } = await import("@/lib/compliance");
    await assertFinancialActive(data.tenantId);

    const secretKey = process.env.PAGARME_SECRET_KEY;
    if (!secretKey) throw new Error("PAGARME_SECRET_KEY não configurada");

    const sellerRecipientId = await fetchSellerRecipientId(data.tenantId);
    const amounts = calculateBoletoAmounts(data.donationAmount);
    if (process.env.NODE_ENV !== "production") {
      console.log("[boleto] amounts", amounts, { sellerRecipientId });
    }
    const platformRecipientId = process.env.PLATFORM_RECIPIENT_ID;
    const dueAt = addBusinessDays(new Date(), 3).toISOString();

    const resolved = await resolveCustomer(data);
    if (!resolved.name) throw new Error("Nome é obrigatório para boleto");
    if (!resolved.email) throw new Error("E-mail é obrigatório para boleto");
    if (!resolved.document) throw new Error("CPF ou CNPJ é obrigatório para boleto");
    if (!validateDocument(resolved.document)) throw new Error("CPF ou CNPJ inválido");

    // Endereço do tenant (fonte do endereço do pagador no boleto)
    const { data: tAddr } = await supabaseAdmin
      .from("tenant_address")
      .select("cep, rua, numero, neighborhood, city, uf, estado")
      .eq("tenant_id", data.tenantId)
      .maybeSingle();
    const addrRow = tAddr as
      | {
          cep?: string | null;
          rua?: string | null;
          numero?: string | null;
          neighborhood?: string | null;
          city?: string | null;
          uf?: string | null;
          estado?: string | null;
        }
      | null;

    const customer = {
      ...buildPagarmeCustomer(resolved),
      address: {
        line_1: addrRow?.rua
          ? `${addrRow.numero ?? "s/n"}, ${addrRow.rua}, ${addrRow.neighborhood ?? ""}`.trim()
          : "Endereço não informado",
        zip_code: (addrRow?.cep ?? "").replace(/\D/g, "") || "00000000",
        city: addrRow?.city ?? "São Paulo",
        state: (addrRow?.uf ?? addrRow?.estado ?? "SP").slice(0, 2).toUpperCase(),
        country: "BR",
      },
    };

    const { data: tenantBankAccount } = await supabaseAdmin
      .from("tenant_bank_account")
      .select("bank_code")
      .eq("tenant_id", data.tenantId)
      .maybeSingle();

    const orderPayload = {
      items: [
        {
          amount: amounts.totalAmount,
          description: "Contribuição",
          quantity: 1,
          code: "CONTRIB",
        },
      ],
      customer,
      payments: [
        {
          payment_method: "boleto",
          boleto: {
            bank: tenantBankAccount?.bank_code ?? "077",
            due_at: dueAt,
            instructions: "Obrigado pela sua contribuição!",
            document_number: `CONTRIB-${Date.now()}`,
          },
          split: buildSplitPayload(amounts, sellerRecipientId),
        },
      ],
    };

    const auth = "Basic " + Buffer.from(`${secretKey}:`).toString("base64");
    const res = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    const raw = await res.text();
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error(`Resposta inválida da Pagar.me: ${raw.slice(0, 200)}`);
    }
    if (!res.ok) {
      console.error("[boleto] pagar.me rejected", {
        status: res.status,
        errors: json?.errors,
        message: json?.message,
        sentPayload: orderPayload,
      });
      const msg =
        json?.message ||
        (json?.errors && JSON.stringify(json.errors)) ||
        `Erro ${res.status} ao criar boleto`;
      throw new Error(msg);
    }

    const charge = json?.charges?.[0];
    const tx = charge?.last_transaction;
    const line: string = tx?.line ?? "";
    const barcode: string = tx?.barcode ?? "";
    const pdfUrl: string = tx?.pdf ?? tx?.url ?? "";
    const gatewayId: string = json?.id ?? charge?.id ?? "";

    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .insert({
        tenant_id: data.tenantId,
        amount: amounts.totalAmount / 100,
        method: "boleto",
        status: "pending",
        gateway_id: gatewayId,
        reference_type: "donation",
        donation_amount: amounts.donationAmount,
        ticketto_fee: amounts.tickettoFee,
        pagarme_fee: amounts.pagarmeFee,
        tk2_op_fee: amounts.tk2OpFee,
        transacao_fee: amounts.transacaoFee,
        split_platform_amount: amounts.splitPlatformAmount,
        split_seller_amount: amounts.donationAmount,
        platform_recipient_id: platformRecipientId,
        seller_recipient_id: sellerRecipientId,
      } as any)
      .select("id")
      .single();
    if (payErr || !payment) throw new Error(payErr?.message ?? "Falha ao registrar pagamento");

    const { data: donation, error: donErr } = await supabaseAdmin
      .from("donations")
      .insert({
        tenant_id: data.tenantId,
        amount: amounts.donationAmount / 100,
        payment_id: payment.id,
      })
      .select("id")
      .single();
    if (donErr || !donation) throw new Error(donErr?.message ?? "Falha ao registrar doação");

    await supabaseAdmin
      .from("payments")
      .update({ reference_id: donation.id })
      .eq("id", payment.id);

    return {
      paymentId: payment.id as string,
      donationId: donation.id as string,
      line,
      barcode,
      pdfUrl,
      dueAt,
      gatewayId,
      donationAmount: amounts.donationAmount,
      tickettoFee: amounts.tickettoFee,
      totalAmount: amounts.totalAmount,
    };
  });

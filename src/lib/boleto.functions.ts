import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  buildSplitPayload,
  calculateAmounts,
  fetchSellerRecipientId,
} from "./split.utils";
import { buildPagarmeCustomer, resolveCustomer } from "./payments-customer";

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

    const secretKey = process.env.PAGARME_SECRET_KEY;
    if (!secretKey) throw new Error("PAGARME_SECRET_KEY não configurada");

    const sellerRecipientId = await fetchSellerRecipientId(data.tenantId);
    const { donationAmount, tickettoFee, totalAmount } = calculateAmounts(data.donationAmount);
    const platformRecipientId = process.env.PLATFORM_RECIPIENT_ID;
    const dueAt = addBusinessDays(new Date(), 3).toISOString();

    const resolved = await resolveCustomer(data);
    if (!resolved.name) throw new Error("Nome é obrigatório para boleto");
    if (!resolved.email) throw new Error("E-mail é obrigatório para boleto");
    if (!resolved.document) throw new Error("CPF ou CNPJ é obrigatório para boleto");
    const customer = buildPagarmeCustomer(resolved, { allowAnonymous: false });

    const orderPayload = {
      items: [
        {
          amount: totalAmount,
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
            due_at: dueAt,
            instructions: "Obrigado pela sua contribuição!",
          },
          split: buildSplitPayload(donationAmount, tickettoFee, sellerRecipientId),
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
        amount: totalAmount / 100,
        method: "boleto",
        status: "pending",
        gateway_id: gatewayId,
        reference_type: "donation",
        donation_amount: donationAmount,
        ticketto_fee: tickettoFee,
        split_platform_amount: tickettoFee,
        split_seller_amount: donationAmount,
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
        amount: donationAmount / 100,
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
      donationAmount,
      tickettoFee,
      totalAmount,
    };
  });

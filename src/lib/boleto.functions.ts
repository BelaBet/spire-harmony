import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  tenantId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  customerName: z.string().min(1).max(120).optional(),
  customerEmail: z.string().email().optional(),
  customerDocument: z.string().min(8).max(20).optional(),
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

    const amountCents = Math.round(data.amount * 100);
    const dueAt = addBusinessDays(new Date(), 3).toISOString();

    const orderPayload = {
      items: [
        {
          amount: amountCents,
          description: "Contribuição",
          quantity: 1,
        },
      ],
      customer: {
        name: data.customerName ?? "Contribuinte Anônimo",
        email: data.customerEmail ?? "contribuinte@anonimo.com",
        type: "individual",
        document: (data.customerDocument ?? "00000000000").replace(/\D/g, ""),
        document_type: "CPF",
      },
      payments: [
        {
          payment_method: "boleto",
          boleto: {
            due_at: dueAt,
            instructions: "Obrigado pela sua contribuição!",
          },
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
        amount: data.amount,
        method: "boleto",
        status: "pending",
        gateway_id: gatewayId,
        reference_type: "donation",
      })
      .select("id")
      .single();
    if (payErr || !payment) throw new Error(payErr?.message ?? "Falha ao registrar pagamento");

    const { data: donation, error: donErr } = await supabaseAdmin
      .from("donations")
      .insert({
        tenant_id: data.tenantId,
        amount: data.amount,
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
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  tenantId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  gatewayId: z.string().min(1).max(128),
});

export const createBoletoPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .insert({
        tenant_id: data.tenantId,
        amount: data.amount,
        method: "boleto",
        status: "pending",
        gateway_id: data.gatewayId,
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

    return { paymentId: payment.id as string, donationId: donation.id as string };
  });

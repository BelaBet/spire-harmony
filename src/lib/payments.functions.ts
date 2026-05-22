import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CustomerSchema = {
  customerName: z.string().min(2).max(120),
  customerEmail: z.string().email(),
  customerDocument: z.string().min(8).max(20),
  customerPhone: z.string().min(10).max(20),
};

const OptionalCustomerSchema = {
  customerName: z.string().min(2).max(120).optional(),
  customerEmail: z.string().email().optional(),
  customerDocument: z.string().min(8).max(20).optional(),
  customerPhone: z.string().min(10).max(20).optional(),
};


function parseBrPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  // Aceita 10 (fixo) ou 11 (celular) dígitos; opcional 55 country
  const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  const area_code = local.slice(0, 2);
  const number = local.slice(2);
  return { country_code: "55", area_code, number };
}

function buildCustomer(data: {
  customerName?: string;
  customerEmail?: string;
  customerDocument?: string;
  customerPhone?: string;
}) {
  const phone = parseBrPhone(data.customerPhone ?? "11900000000");
  return {
    name: data.customerName ?? "Contribuinte Anônimo",
    email: data.customerEmail ?? "contribuinte@anonimo.com",
    type: "individual",
    document: (data.customerDocument ?? "00000000000").replace(/\D/g, ""),
    document_type: "CPF",
    phones: { mobile_phone: phone },
  };
}


function buildItems(amountCents: number) {
  return [
    {
      amount: amountCents,
      description: "Contribuição",
      quantity: 1,
      code: "CONTRIB",
    },
  ];
}

const PixInput = z.object({
  tenantId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  ...OptionalCustomerSchema,
});


const CardInput = z.object({
  tenantId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  installments: z.number().int().min(1).max(12).default(1),
  card: z.object({
    number: z.string().min(13).max(19),
    holderName: z.string().min(2).max(120),
    expMonth: z.number().int().min(1).max(12),
    expYear: z.number().int().min(2024).max(2100),
    cvv: z.string().min(3).max(4),
  }),
  billingAddress: z.object({
    line1: z.string().min(3).max(200),
    zipCode: z.string().min(8).max(9),
    city: z.string().min(2).max(80),
    state: z.string().length(2),
    country: z.string().length(2).default("BR"),
  }),
  ...CustomerSchema,
});

async function pagarmeFetch(path: string, body: unknown) {
  const secretKey = process.env.PAGARME_SECRET_KEY;
  if (!secretKey) throw new Error("PAGARME_SECRET_KEY não configurada");
  const auth = "Basic " + Buffer.from(`${secretKey}:`).toString("base64");
  const res = await fetch(`https://api.pagar.me/core/v5${path}`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
      `Erro ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

async function persistPayment(args: {
  tenantId: string;
  amount: number;
  method: "pix" | "credit_card";
  status: "pending" | "confirmed" | "failed";
  gatewayId: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: payment, error: payErr } = await supabaseAdmin
    .from("payments")
    .insert({
      tenant_id: args.tenantId,
      amount: args.amount,
      method: args.method,
      status: args.status,
      gateway_id: args.gatewayId,
      reference_type: "donation",
    })
    .select("id")
    .single();
  if (payErr || !payment) throw new Error(payErr?.message ?? "Falha ao registrar pagamento");

  const { data: donation, error: donErr } = await supabaseAdmin
    .from("donations")
    .insert({
      tenant_id: args.tenantId,
      amount: args.amount,
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
}

export const createPixPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PixInput.parse(data))
  .handler(async ({ data }) => {
    const amountCents = Math.round(data.amount * 100);
    const expiresIn = 60 * 60; // 1h

    const json = await pagarmeFetch("/orders", {
      items: buildItems(amountCents),
      customer: buildCustomer(data),
      payments: [
        {
          payment_method: "pix",
          pix: {
            expires_in: expiresIn,
            additional_information: [{ name: "Contribuição", value: data.customerName ?? "Anônimo" }],
          },
        },
      ],
    });

    const charge = json?.charges?.[0];
    const tx = charge?.last_transaction;
    const qrCode: string = tx?.qr_code ?? "";
    const qrCodeUrl: string = tx?.qr_code_url ?? "";
    const expiresAt: string = tx?.expires_at ?? new Date(Date.now() + expiresIn * 1000).toISOString();
    const gatewayId: string = json?.id ?? charge?.id ?? "";

    if (!gatewayId) {
      console.error("[pix] resposta sem gatewayId", { json });
      throw new Error(
        `Pagar.me não retornou identificador do pedido. Status: ${json?.status ?? "?"}. ` +
        `Verifique a configuração da conta (recebedor/chave PIX).`
      );
    }

    if (!qrCode) {
      // QR ainda não disponível: persistimos pending e o cliente fará polling
      // até o webhook/processamento async gerar o código.
      console.warn("[pix] QR Code ainda não disponível na criação", {
        orderStatus: json?.status,
        chargeStatus: charge?.status,
        txStatus: tx?.status,
      });
    }

    const ids = await persistPayment({
      tenantId: data.tenantId,
      amount: data.amount,
      method: "pix",
      status: "pending",
      gatewayId,
    });

    return {
      ...ids,
      qrCode,
      qrCodeUrl,
      expiresAt,
      gatewayId,
      pending: !qrCode,
    };
  });

const PollInput = z.object({
  gatewayId: z.string().min(3).max(64),
});

export const pollPixCharge = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PollInput.parse(data))
  .handler(async ({ data }) => {
    const secretKey = process.env.PAGARME_SECRET_KEY;
    if (!secretKey) throw new Error("PAGARME_SECRET_KEY não configurada");
    const auth = "Basic " + Buffer.from(`${secretKey}:`).toString("base64");

    const res = await fetch(
      `https://api.pagar.me/core/v5/orders/${encodeURIComponent(data.gatewayId)}`,
      { method: "GET", headers: { Authorization: auth } },
    );
    const raw = await res.text();
    let json: any;
    try { json = JSON.parse(raw); } catch {
      throw new Error(`Resposta inválida da Pagar.me: ${raw.slice(0, 200)}`);
    }
    if (!res.ok) {
      throw new Error(json?.message || `Erro ${res.status} ao consultar pedido`);
    }

    const charge = json?.charges?.[0];
    const tx = charge?.last_transaction;
    const qrCode: string = tx?.qr_code ?? "";
    const qrCodeUrl: string = tx?.qr_code_url ?? "";
    const expiresAt: string = tx?.expires_at ?? "";
    const orderStatus: string = json?.status ?? "";
    const chargeStatus: string = charge?.status ?? "";

    const mapped: "paid" | "failed" | null =
      chargeStatus === "paid" ? "paid"
      : chargeStatus === "failed" || chargeStatus === "refused" ? "failed"
      : null;

    if (mapped) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("payments")
        .update({ status: mapped as any })
        .eq("gateway_id", data.gatewayId);
    }

    return { qrCode, qrCodeUrl, expiresAt, orderStatus, chargeStatus };
  });

export const createCreditCardPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CardInput.parse(data))
  .handler(async ({ data }) => {
    const amountCents = Math.round(data.amount * 100);

    const json = await pagarmeFetch("/orders", {
      items: buildItems(amountCents),
      customer: buildCustomer(data),
      payments: [
        {
          payment_method: "credit_card",
          credit_card: {
            installments: data.installments,
            statement_descriptor: "CONTRIB",
            card: {
              number: data.card.number.replace(/\s/g, ""),
              holder_name: data.card.holderName,
              exp_month: data.card.expMonth,
              exp_year: data.card.expYear,
              cvv: data.card.cvv,
              billing_address: {
                line_1: data.billingAddress.line1,
                zip_code: data.billingAddress.zipCode.replace(/\D/g, ""),
                city: data.billingAddress.city,
                state: data.billingAddress.state.toUpperCase(),
                country: data.billingAddress.country.toUpperCase(),
              },
            },
          },
        },
      ],
    });

    const charge = json?.charges?.[0];
    const status: string = charge?.status ?? "pending";
    const gatewayId: string = json?.id ?? charge?.id ?? "";

    const mapped: "pending" | "confirmed" | "failed" =
      status === "paid" ? "confirmed" : status === "failed" || status === "refused" ? "failed" : "pending";

    const ids = await persistPayment({
      tenantId: data.tenantId,
      amount: data.amount,
      method: "credit_card",
      status: mapped,
      gatewayId,
    });

    return {
      ...ids,
      status: mapped,
      gatewayId,
      acquirerMessage: charge?.last_transaction?.acquirer_message ?? null,
    };
  });

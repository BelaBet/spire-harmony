import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  buildSplitPayload,
  calculateAmounts,
  fetchSellerRecipientId,
} from "./split.utils";
import { buildPagarmeCustomer, resolveCustomer } from "./payments-customer";

const OptionalCustomerSchema = {
  customerName: z.string().min(2).max(120).optional(),
  customerEmail: z.string().email().optional(),
  customerDocument: z.string().min(8).max(20).optional(),
  customerPhone: z.string().min(10).max(20).optional(),
};

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

// donationAmount sempre em CENTAVOS (integer)
const DonationAmount = z.number().int().positive().max(100_000_000);

const PixInput = z.object({
  tenantId: z.string().uuid(),
  donationAmount: DonationAmount,
  ...OptionalCustomerSchema,
});

const CardInput = z.object({
  tenantId: z.string().uuid(),
  donationAmount: DonationAmount,
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
  ...OptionalCustomerSchema,
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
  donationAmount: number;     // centavos
  tickettoFee: number;        // centavos
  totalAmount: number;        // centavos
  sellerRecipientId: string;
  method: "pix" | "credit_card";
  status: "pending" | "confirmed" | "failed";
  gatewayId: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const platformRecipientId = process.env.PLATFORM_RECIPIENT_ID;

  const { data: payment, error: payErr } = await supabaseAdmin
    .from("payments")
    .insert({
      tenant_id: args.tenantId,
      amount: args.totalAmount / 100, // coluna histórica em reais (valor total cobrado)
      method: args.method,
      status: args.status,
      gateway_id: args.gatewayId,
      reference_type: "donation",
      donation_amount: args.donationAmount,
      ticketto_fee: args.tickettoFee,
      split_platform_amount: args.tickettoFee,
      split_seller_amount: args.donationAmount,
      platform_recipient_id: platformRecipientId,
      seller_recipient_id: args.sellerRecipientId,
    } as any)
    .select("id")
    .single();
  if (payErr || !payment) throw new Error(payErr?.message ?? "Falha ao registrar pagamento");

  const { data: donation, error: donErr } = await supabaseAdmin
    .from("donations")
    .insert({
      tenant_id: args.tenantId,
      amount: args.donationAmount / 100, // doação registra apenas o valor doado (sem taxa)
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
    const sellerRecipientId = await fetchSellerRecipientId(data.tenantId);
    const { donationAmount, tickettoFee, totalAmount } = calculateAmounts(data.donationAmount);
    const expiresIn = 60 * 60; // 1h

    const resolved = await resolveCustomer(data);
    const customer = buildPagarmeCustomer(resolved, { allowAnonymous: true });

    const json = await pagarmeFetch("/orders", {
      items: buildItems(totalAmount),
      customer,
      payments: [
        {
          payment_method: "pix",
          pix: {
            expires_in: expiresIn,
            additional_information: [
              { name: "Contribuição", value: resolved.name ?? "Anônimo" },
            ],
          },
          split: buildSplitPayload(donationAmount, tickettoFee, sellerRecipientId),
        },
      ],
    });

    const charge = json?.charges?.[0];
    const tx = charge?.last_transaction;
    const qrCode: string = tx?.qr_code ?? "";
    const qrCodeUrl: string = tx?.qr_code_url ?? "";
    const expiresAt: string =
      tx?.expires_at ?? new Date(Date.now() + expiresIn * 1000).toISOString();
    const gatewayId: string = json?.id ?? charge?.id ?? "";

    if (!gatewayId) {
      console.error("[pix] resposta sem gatewayId", { json });
      throw new Error(
        `Pagar.me não retornou identificador do pedido. Status: ${json?.status ?? "?"}.`,
      );
    }

    const ids = await persistPayment({
      tenantId: data.tenantId,
      donationAmount,
      tickettoFee,
      totalAmount,
      sellerRecipientId,
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
      donationAmount,
      tickettoFee,
      totalAmount,
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
    try {
      json = JSON.parse(raw);
    } catch {
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
      chargeStatus === "paid"
        ? "paid"
        : chargeStatus === "failed" || chargeStatus === "refused"
          ? "failed"
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
    const sellerRecipientId = await fetchSellerRecipientId(data.tenantId);
    const { donationAmount, tickettoFee, totalAmount } = calculateAmounts(data.donationAmount);

    const resolved = await resolveCustomer(data);
    if (!resolved.name) throw new Error("Nome do titular é obrigatório");
    if (!resolved.email) throw new Error("E-mail é obrigatório");
    if (!resolved.document) throw new Error("CPF ou CNPJ é obrigatório");
    if (!data.billingAddress) throw new Error("Endereço de cobrança é obrigatório");
    const customer = buildPagarmeCustomer(resolved, { allowAnonymous: false });

    const json = await pagarmeFetch("/orders", {
      items: buildItems(totalAmount),
      customer,
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
          split: buildSplitPayload(donationAmount, tickettoFee, sellerRecipientId),
        },
      ],
    });

    const charge = json?.charges?.[0];
    const status: string = charge?.status ?? "pending";
    const gatewayId: string = json?.id ?? charge?.id ?? "";

    const mapped: "pending" | "confirmed" | "failed" =
      status === "paid"
        ? "confirmed"
        : status === "failed" || status === "refused"
          ? "failed"
          : "pending";

    const ids = await persistPayment({
      tenantId: data.tenantId,
      donationAmount,
      tickettoFee,
      totalAmount,
      sellerRecipientId,
      method: "credit_card",
      status: mapped,
      gatewayId,
    });

    return {
      ...ids,
      status: mapped,
      gatewayId,
      donationAmount,
      tickettoFee,
      totalAmount,
      acquirerMessage: charge?.last_transaction?.acquirer_message ?? null,
    };
  });
